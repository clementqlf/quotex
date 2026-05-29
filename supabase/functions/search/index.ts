/**
 * Edge Function: /search
 * Handles: GET /search?q=...
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { getAuthUser } from '../_shared/auth.ts';
import { formatAuthor, formatBook, formatQuote } from '../_shared/formatters.ts';
import {
  searchInventaireWorks,
  searchInventaireAuthors,
  searchInventaire,
  getInventaireBookByIsbn,
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
  const user = await getAuthUser(req);
  const authUserId = user?.id ?? null;

  try {
    const cleanQ = q.replace(/[-\s]/g, '');
    const isIsbn = /^(?:97[89])?\d{9}[\dxX]$/i.test(cleanQ);

    if (isIsbn) {
      console.log(`[search] ISBN detected: "${cleanQ}". Checking local database first.`);
      try {
        // 1. Search in Edition table (ISBN belongs to an edition, not a work)
        const editionMatch = await sql`
          SELECT b.*, e.isbn as isbn, row_to_json(a) as author,
            COALESCE((SELECT json_agg(ub) FROM "UserBook" ub WHERE ub."bookId" = b.id AND ub."userId" = ${authUserId}::uuid), '[]'::json) as users,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', l.id,
                'year', l.year,
                'prizeId', l."prizeId",
                'authorId', l."authorId",
                'bookId', l."bookId",
                'prize', (SELECT row_to_json(lp) FROM "LiteraryPrize" lp WHERE lp.id = l."prizeId")
              ))
              FROM "Laureate" l
              WHERE l."bookId" = b.id
            ), '[]'::json) as laureates
          FROM "Edition" e
          JOIN "Book" b ON b.id = e."bookId"
          LEFT JOIN "Author" a ON a.id = b."authorId"
          WHERE replace(e.isbn, '-', '') = ${cleanQ}
          LIMIT 1
        `;

        if (editionMatch.length > 0) {
          console.log(`[search] ISBN "${cleanQ}" found in Edition table → parent book ID: ${editionMatch[0].id}.`);
          return json({
            quotes: [],
            authors: [],
            books: editionMatch.map((b: any) => formatBook(b, authUserId)),
            prizes: [],
            themes: [],
            inventaireWorks: [],
            inventaireAuthors: [],
            inventairePrizes: [],
          });
        }
      } catch (dbError) {
        console.error('[search] Local ISBN lookup failed:', dbError);
      }

      console.log(`[search] ISBN "${cleanQ}" not found in local DB. Searching via Inventaire.`);
      try {
        const mappedResult = await getInventaireBookByIsbn(cleanQ);
        if (mappedResult) {
          return json({
            quotes: [],
            authors: [],
            books: [],
            prizes: [],
            themes: [],
            inventaireWorks: [mappedResult],
            inventaireAuthors: [],
            inventairePrizes: [],
          });
        }
      } catch (invError) {
        console.error('[search] Inventaire ISBN lookup failed:', invError);
      }

      // If it is an ISBN but wasn't found in local DB or Inventaire, return empty immediately
      return json({
        quotes: [],
        authors: [],
        books: [],
        prizes: [],
        themes: [],
        inventaireWorks: [],
        inventaireAuthors: [],
        inventairePrizes: [],
      });
    }

    console.log(`[search] Starting search for "${query}"`);
    
    // 1-5. Local queries
    console.log(`[search] Executing local DB queries...`);
    const [quotesRaw, localAuthorsRaw, localBooksRaw, themesRaw, prizesRaw] = await Promise.all([
      sql`
        SELECT q.id, q.text, q."userId", q."authorId", q."bookId", q."date", q.theme, q."aiInterpretation", q."blockData",
          row_to_json(a) as author, row_to_json(b) as book,
          (SELECT json_build_object('id', u.id, 'username', u.username, 'name', u.name, 'image', u.image) FROM "Profile" u WHERE u.id = q."userId") as user,
          (SELECT COUNT(*) FROM "Like" l WHERE l."quoteId" = q.id)::int as "likesCount"
        FROM "Quote" q
        LEFT JOIN "Author" a ON a.id = q."authorId"
        LEFT JOIN "Book" b ON b.id = q."bookId"
        WHERE q.text ILIKE ${'%' + query + '%'} OR q.theme ILIKE ${'%' + query + '%'}
        LIMIT 20
      `,
      sql`
        SELECT a.*, COALESCE((SELECT json_agg(ua) FROM "UserAuthor" ua WHERE ua."authorId" = a.id AND ua."userId" = ${authUserId}::uuid), '[]'::json) as users
        FROM "Author" a
        WHERE a.name ILIKE ${'%' + query + '%'}
        LIMIT 10
      `,
      sql`
        SELECT b.*, 
          (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn,
          row_to_json(a) as author,
          COALESCE((SELECT json_agg(ub) FROM "UserBook" ub WHERE ub."bookId" = b.id AND ub."userId" = ${authUserId}::uuid), '[]'::json) as users,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', l.id,
              'year', l.year,
              'prizeId', l."prizeId",
              'authorId', l."authorId",
              'bookId', l."bookId",
              'prize', (SELECT row_to_json(lp) FROM "LiteraryPrize" lp WHERE lp.id = l."prizeId")
            ))
            FROM "Laureate" l
            WHERE l."bookId" = b.id
          ), '[]'::json) as laureates
        FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId"
        WHERE b.title ILIKE ${'%' + query + '%'}
        LIMIT 10
      `,
      sql`
        SELECT DISTINCT theme FROM "Quote"
        WHERE theme ILIKE ${'%' + query + '%'} AND theme IS NOT NULL
        LIMIT 10
      `,
      sql`
        SELECT * FROM "LiteraryPrize"
        WHERE name ILIKE ${'%' + query + '%'}
        LIMIT 10
      `
    ]);
    console.log(`[search] Local queries done.`);

    // 5-7. Inventaire searches
    console.log(`[search] Executing Inventaire searches...`);
    const [inventaireWorks, inventaireAuthors, inventairePrizes] = await Promise.all([
      (async () => {
        const cached = await sql`SELECT results, "expiresAt" FROM "SearchCache" WHERE query = ${query} AND type = 'sujets' LIMIT 1`.catch(() => []);
        if (cached.length > 0 && new Date(cached[0].expiresAt) > new Date()) {
          try {
            const results = typeof cached[0].results === 'string' ? JSON.parse(cached[0].results) : cached[0].results;
            return Array.isArray(results) ? results : [];
          } catch { return []; }
        }
        const fresh = await searchInventaireWorks(query, 10);
        const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
        await sql`INSERT INTO "SearchCache" (query, type, results, "createdAt", "expiresAt") VALUES (${query}, 'sujets', ${JSON.stringify(fresh)}, now(), ${expiresAt}) ON CONFLICT (query, type) DO UPDATE SET results = EXCLUDED.results, "expiresAt" = EXCLUDED."expiresAt"`.catch((err) => console.error('[search] Cache write error', err));
        return fresh;
      })(),
      (async () => {
        const cached = await sql`SELECT results, "expiresAt" FROM "SearchCache" WHERE query = ${query} AND type = 'humans' LIMIT 1`.catch(() => []);
        if (cached.length > 0 && new Date(cached[0].expiresAt) > new Date()) {
          try {
            const results = typeof cached[0].results === 'string' ? JSON.parse(cached[0].results) : cached[0].results;
            return Array.isArray(results) ? results : [];
          } catch { return []; }
        }
        const fresh = await searchInventaireAuthors(query, 10);
        const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
        await sql`INSERT INTO "SearchCache" (query, type, results, "createdAt", "expiresAt") VALUES (${query}, 'humans', ${JSON.stringify(fresh)}, now(), ${expiresAt}) ON CONFLICT (query, type) DO UPDATE SET results = EXCLUDED.results, "expiresAt" = EXCLUDED."expiresAt"`.catch((err) => console.error('[search] Cache write error', err));
        return fresh;
      })(),
      (async () => {
        // High-performance hybrid search (Search Index + Property Filter)
        try {
          // 1. Instant full-text search via Wikidata index
          const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=fr&format=json&origin=*&type=item&limit=15`;
          const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'QuotexApp/1.0' } });
          const searchData = await searchRes.json();
          const results = searchData.search || [];
          if (results.length === 0) return [];

          // 2. Batch check nature of items (P31) in one single request
          const qids = results.map((r: any) => r.id);
          const propsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join('|')}&props=claims&format=json&origin=*`;
          const propsRes = await fetch(propsUrl, { headers: { 'User-Agent': 'QuotexApp/1.0' } });
          const propsData = await propsRes.json();

          // Award-related QIDs: Literary award (Q616509), Prize (Q131647), Award (Q7161), 
          // Medal (Q131647), Distinction (Q1771146), etc.
          const prizeTypeQids = ['Q616509', 'Q131647', 'Q7161', 'Q380334', 'Q1771146', 'Q132338', 'Q1033596'];

          return results
            .filter((r: any) => {
              const entity = propsData.entities?.[r.id];
              const p31Claims = entity?.claims?.P31 || [];
              const instanceOfIds = p31Claims.map((c: any) => c.mainsnak?.datavalue?.value?.id);
              // We also check if the label/description contains "prix" just in case P31 is missing
              const hasPrizeKeyword = (r.label || '').toLowerCase().includes('prix') || (r.description || '').toLowerCase().includes('prix');
              return instanceOfIds.some((id: string) => prizeTypeQids.includes(id)) || hasPrizeKeyword;
            })
            .map((r: any) => ({
               id: r.id,
               uri: `wd:${r.id}`,
               label: r.label,
               description: r.description,
               image: null
            }));
        } catch (e) {
          console.error('[search] Wikidata hybrid search error:', e);
          return [];
        }
      })()
    ]);
    console.log(`[search] Inventaire searches done.`);

    return json({
      quotes: quotesRaw.map((q: any) => formatQuote(q, authUserId)),
      authors: localAuthorsRaw.map((a: any) => formatAuthor(a, 0)),
      books: localBooksRaw.map((b: any) => formatBook(b, 0)),
      prizes: prizesRaw || [],
      themes: themesRaw.map((t: any) => t.theme),
      inventaireWorks: inventaireWorks || [],
      inventaireAuthors: inventaireAuthors || [],
      inventairePrizes: inventairePrizes || [],
    });
  } catch (e: any) {
    console.error('[search] Fatal error:', e);
    return error(`Search service error: ${e.message || 'Unknown error'}\n${e.stack || ''}`, 500);
  }
});
