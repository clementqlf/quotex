/**
 * Edge Function: /search
 * Handles: GET /search?q=...
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { formatAuthor, formatBook, formatQuote } from '../_shared/formatters.ts';
import {
  searchInventaireWorks,
  searchInventaireAuthors,
  InventaireSearchResult,
} from '../_shared/inventaire.api.ts';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== 'GET') return error('Method not allowed', 405);

  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  if (!q) return error('Missing query parameter "q"', 400);

  const query = q.toLowerCase();

  try {
    // 1. Local quotes
    const quotesRaw = await sql`
      SELECT q.*, row_to_json(a) as author, row_to_json(b) as book, row_to_json(u) as user,
        (SELECT COUNT(*) FROM "Like" l WHERE l."quoteId" = q.id)::int as "likesCount"
      FROM "Quote" q
      LEFT JOIN "Author" a ON a.id = q."authorId"
      LEFT JOIN "Book" b ON b.id = q."bookId"
      LEFT JOIN "User" u ON u.id = q."userId"
      WHERE q.text ILIKE ${'%' + query + '%'} OR q.theme ILIKE ${'%' + query + '%'}
      LIMIT 20
    `;

    // 2. Local authors (saved)
    const localAuthorsRaw = await sql`
      SELECT a.*, COALESCE((SELECT json_agg(ua) FROM "UserAuthor" ua WHERE ua."authorId" = a.id), '[]'::json) as users
      FROM "Author" a
      WHERE a.name ILIKE ${'%' + query + '%'}
      LIMIT 10
    `;

    // 3. Local books (saved)
    const localBooksRaw = await sql`
      SELECT b.*, row_to_json(a) as author,
        COALESCE((SELECT json_agg(ub) FROM "UserBook" ub WHERE ub."bookId" = b.id), '[]'::json) as users
      FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId"
      WHERE b.title ILIKE ${'%' + query + '%'}
      LIMIT 10
    `;

    // 4. Themes
    const themesRaw = await sql`
      SELECT DISTINCT theme FROM "Quote"
      WHERE theme ILIKE ${'%' + query + '%'} AND theme IS NOT NULL
      LIMIT 10
    `;

    // 5. Inventaire works (with DB cache)
    let inventaireWorks: InventaireSearchResult[] = [];
    const cachedWorks = await sql`
      SELECT results, "expiresAt" FROM "SearchCache"
      WHERE query = ${query} AND type = 'sujets' LIMIT 1
    `;

    if (cachedWorks.length > 0 && new Date(cachedWorks[0].expiresAt) > new Date()) {
      try { inventaireWorks = JSON.parse(cachedWorks[0].results); } catch {}
    } else {
      inventaireWorks = await searchInventaireWorks(query, 10);
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
      await sql`
        INSERT INTO "SearchCache" (query, type, results, "createdAt", "expiresAt")
        VALUES (${query}, 'sujets', ${JSON.stringify(inventaireWorks)}, now(), ${expiresAt})
        ON CONFLICT (query, type) DO UPDATE SET results = EXCLUDED.results, "expiresAt" = EXCLUDED."expiresAt"
      `.catch(() => {});
    }

    // 6. Inventaire authors (with DB cache)
    let inventaireAuthors: InventaireSearchResult[] = [];
    const cachedAuthors = await sql`
      SELECT results, "expiresAt" FROM "SearchCache"
      WHERE query = ${query} AND type = 'humans' LIMIT 1
    `;

    if (cachedAuthors.length > 0 && new Date(cachedAuthors[0].expiresAt) > new Date()) {
      try { inventaireAuthors = JSON.parse(cachedAuthors[0].results); } catch {}
    } else {
      inventaireAuthors = await searchInventaireAuthors(query, 10);
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
      await sql`
        INSERT INTO "SearchCache" (query, type, results, "createdAt", "expiresAt")
        VALUES (${query}, 'humans', ${JSON.stringify(inventaireAuthors)}, now(), ${expiresAt})
        ON CONFLICT (query, type) DO UPDATE SET results = EXCLUDED.results, "expiresAt" = EXCLUDED."expiresAt"
      `.catch(() => {});
    }

    return json({
      quotes: quotesRaw.map((q: any) => formatQuote(q, 0)),
      authors: localAuthorsRaw.map((a: any) => formatAuthor(a, 0)),
      books: localBooksRaw.map((b: any) => formatBook(b, 0)),
      themes: themesRaw.map((t: any) => t.theme),
      inventaireWorks,
      inventaireAuthors,
    });
  } catch (e) {
    console.error('[search]', e);
    return error('Internal server error');
  }
});
