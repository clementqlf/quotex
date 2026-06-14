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

  const query = q.trim().replace(/\s+/g, ' ').toLowerCase();
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
            COALESCE((SELECT json_agg(json_build_object('userId', ub."userId", 'bookId', ub."bookId", 'status', ub.status, 'addedAt', ub."addedAt", 'addedViaQuote', ub."addedViaQuote")) FROM "UserBook" ub WHERE ub."bookId" = b.id AND ub."userId" = ${authUserId}::uuid), '[]'::json) as users,
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
            users: [],
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
            users: [],
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
        users: [],
      });
    }

    console.log(`[search] Starting search for "${query}"`);
    
    // 1-5. Local queries
    console.log(`[search] Executing local DB queries...`);
    const [quotesRaw, localAuthorsRaw, localBooksRaw, themesRaw, prizesRaw, usersRaw] = await Promise.all([
      // ✅ CORRECTION: Utiliser des JOINs au lieu de sous-requêtes pour user et author
      sql`
        SELECT q.id, q.text, q."userId", q."authorId", q."bookId", q."date", q.theme, q."aiInterpretation", q."blockData",
          row_to_json(u) as user,
          row_to_json(a) as author,
          row_to_json(b) as book,
          (SELECT COUNT(*) FROM "Like" l WHERE l."quoteId" = q.id)::int as "likesCount",
          ts_rank(to_tsvector('french', q.text), websearch_to_tsquery('french', ${query})) as rank
        FROM "Quote" q
        LEFT JOIN "Profile" u ON u.id = q."userId"
        LEFT JOIN "Author" a ON a.id = q."authorId"
        LEFT JOIN "Book" b ON b.id = q."bookId"
        WHERE (q."isPublic" = true OR q."userId" = ${authUserId}::uuid)
          AND (
            to_tsvector('french', q.text) @@ websearch_to_tsquery('french', ${query})
            OR public.immutable_unaccent(lower(q.text)) ILIKE public.immutable_unaccent(${'%' + query + '%'})
            OR public.immutable_unaccent(lower(q.theme)) ILIKE public.immutable_unaccent(${'%' + query + '%'})
          )
        ORDER BY rank DESC
        LIMIT 20
      `,
      sql`
        SELECT a.*,
          similarity(public.immutable_unaccent(lower(a.name)), public.immutable_unaccent(${query})) as score
        FROM "Author" a
        WHERE public.immutable_unaccent(lower(a.name)) ILIKE public.immutable_unaccent(${'%' + query + '%'})
        ORDER BY
          CASE WHEN public.immutable_unaccent(lower(a.name)) ILIKE public.immutable_unaccent(${query + '%'}) THEN 0 ELSE 1 END,
          score DESC
        LIMIT 10
      `,
      sql`
        SELECT b.*, 
          (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn,
          row_to_json(a) as author,
          similarity(public.immutable_unaccent(lower(b.title)), public.immutable_unaccent(${query})) as score
        FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId"
        WHERE public.immutable_unaccent(lower(b.title)) ILIKE public.immutable_unaccent(${'%' + query + '%'})
        ORDER BY
          CASE WHEN public.immutable_unaccent(lower(b.title)) ILIKE public.immutable_unaccent(${query + '%'}) THEN 0 ELSE 1 END,
          score DESC
        LIMIT 10
      `,
      sql`
        SELECT DISTINCT theme FROM "Quote"
        WHERE ("isPublic" = true OR "userId" = ${authUserId}::uuid)
          AND public.immutable_unaccent(lower(theme)) ILIKE public.immutable_unaccent(${'%' + query + '%'})
          AND theme IS NOT NULL
        LIMIT 10
      `,
      sql`
        SELECT *,
          similarity(public.immutable_unaccent(lower(name)), public.immutable_unaccent(${query})) as score
        FROM "LiteraryPrize"
        WHERE public.immutable_unaccent(lower(name)) ILIKE public.immutable_unaccent(${'%' + query + '%'})
        ORDER BY
          CASE WHEN public.immutable_unaccent(lower(name)) ILIKE public.immutable_unaccent(${query + '%'}) THEN 0 ELSE 1 END,
          score DESC
        LIMIT 10
      `,
      sql`
        SELECT id, username, name, image, bio, website, followers, following, "isPublic",
          GREATEST(
            similarity(public.immutable_unaccent(lower(username)), public.immutable_unaccent(${query})),
            similarity(public.immutable_unaccent(lower(COALESCE(name, ''))), public.immutable_unaccent(${query}))
          ) AS score
        FROM "Profile"
        WHERE ("isPublic" = true OR id = ${authUserId}::uuid)
          AND (${authUserId}::uuid IS NULL OR id != ${authUserId}::uuid)
          AND (
            public.immutable_unaccent(lower(username)) ILIKE public.immutable_unaccent(${'%' + query + '%'}) 
            OR public.immutable_unaccent(lower(COALESCE(name, ''))) ILIKE public.immutable_unaccent(${'%' + query + '%'})
          )
        ORDER BY
          CASE WHEN public.immutable_unaccent(lower(username)) ILIKE public.immutable_unaccent(${query + '%'}) THEN 0 ELSE 1 END,
          score DESC
        LIMIT 10
      `
    ]);
    
    // ✅ CORRECTION: Requêtes batch pour éviter N+1 queries
    if (authUserId) {
      // Batch UserAuthor for authors
      const authorIds = localAuthorsRaw.map((a: any) => a.id).filter(Boolean);
      if (authorIds.length > 0) {
        const userAuthors = await sql`
          SELECT "authorId", json_agg(json_build_object('userId', ua."userId", 'authorId', ua."authorId", 'addedAt', ua."addedAt")) as users
          FROM "UserAuthor" ua
          WHERE ua."authorId" = ANY(${authorIds}) AND ua."userId" = ${authUserId}::uuid
          GROUP BY "authorId"
        `;
        const userAuthorsMap = new Map(userAuthors.map((ua: any) => [ua.authorId, ua.users]));
        for (const a of localAuthorsRaw) {
          a.users = userAuthorsMap.get(a.id) || [];
        }
      }
      
      // Batch UserBook and Laureates for books
      const bookIds = localBooksRaw.map((b: any) => b.id).filter(Boolean);
      if (bookIds.length > 0) {
        const userBooks = await sql`
          SELECT "bookId", json_agg(json_build_object('userId', ub."userId", 'bookId', ub."bookId", 'status', ub.status, 'addedAt', ub."addedAt", 'addedViaQuote', ub."addedViaQuote")) as users
          FROM "UserBook" ub
          WHERE ub."bookId" = ANY(${bookIds}) AND ub."userId" = ${authUserId}::uuid
          GROUP BY "bookId"
        `;
        const userBooksMap = new Map(userBooks.map((ub: any) => [ub.bookId, ub.users]));
        
        const laureates = await sql`
          SELECT l."bookId", 
            json_agg(json_build_object(
              'id', l.id,
              'year', l.year,
              'prizeId', l."prizeId",
              'authorId', l."authorId",
              'bookId', l."bookId",
              'prize', (SELECT row_to_json(lp) FROM "LiteraryPrize" lp WHERE lp.id = l."prizeId")
            )) as laureates
          FROM "Laureate" l
          WHERE l."bookId" = ANY(${bookIds})
          GROUP BY l."bookId"
        `;
        const laureatesMap = new Map(laureates.map((l: any) => [l.bookId, l.laureates || []]));
        
        for (const b of localBooksRaw) {
          b.users = userBooksMap.get(b.id) || [];
          b.laureates = laureatesMap.get(b.id) || [];
        }
      }
      
      // Batch Like and UserQuote for quotes
      const quoteIds = quotesRaw.map((q: any) => q.id).filter(Boolean);
      if (quoteIds.length > 0) {
        const likes = await sql`
          SELECT "quoteId", json_agg(l) as likes
          FROM "Like" l
          WHERE l."quoteId" = ANY(${quoteIds}) AND l."userId" = ${authUserId}::uuid
          GROUP BY "quoteId"
        `;
        const likesMap = new Map(likes.map((l: any) => [l.quoteId, l.likes || []]));
        
        const savedBy = await sql`
          SELECT "quoteId", json_agg(json_build_object('userId', s."userId", 'quoteId', s."quoteId", 'addedAt', s."addedAt")) as savedBy
          FROM "UserQuote" s
          WHERE s."quoteId" = ANY(${quoteIds}) AND s."userId" = ${authUserId}::uuid
          GROUP BY "quoteId"
        `;
        const savedByMap = new Map(savedBy.map((s: any) => [s.quoteId, s.savedBy || []]));
        
        for (const q of quotesRaw) {
          q.likes = likesMap.get(q.id) || [];
          q.savedBy = savedByMap.get(q.id) || [];
        }
      }
    }
    
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
      users: usersRaw || [],
    });
  } catch (e: any) {
    console.error('[search] Fatal error:', e);
    return error(`Search service error: ${e.message || 'Unknown error'}\n${e.stack || ''}`, 500);
  }
});
