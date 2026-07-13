/**
 * Edge Function: /authors
 * Handles all /authors/* routes
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { getAuthUser, requireAuth } from '../_shared/auth.ts';
import { formatAuthor, formatBook } from '../_shared/formatters.ts';
import { enrichAuthorWithInventaire, discoverAuthorWorks } from '../_shared/inventaire.ts';
import { waitUntil } from '../_shared/waitUntil.ts';

async function getAuthorDetails(id: number, userId: string | null) {
  return await sql`
    WITH author_detail AS (
      SELECT id, nationality FROM "Author" WHERE id = ${id} LIMIT 1
    ),
    laureate_scores AS (
      SELECT l2."authorId", COUNT(*)*8 as score
      FROM "Laureate" l1
      JOIN "Laureate" l2 ON l1."prizeId" = l2."prizeId"
      WHERE l1."authorId" = (SELECT id FROM author_detail)
      GROUP BY l2."authorId"
    ),
    genre_scores AS (
      SELECT b2."authorId", COUNT(*)*5 as score
      FROM "Book" b1
      JOIN "Book" b2 ON b1.genre = b2.genre
      WHERE b1."authorId" = (SELECT id FROM author_detail)
        AND b1.genre IS NOT NULL AND b1.genre != '' AND b1.genre != 'Unknown'
      GROUP BY b2."authorId"
    ),
    follower_scores AS (
      SELECT ua2."authorId", COUNT(*)*4 as score
      FROM "UserAuthor" ua1
      JOIN "UserAuthor" ua2 ON ua1."userId" = ua2."userId"
      WHERE ua1."authorId" = (SELECT id FROM author_detail)
      GROUP BY ua2."authorId"
    ),
    combined_scores AS (
      SELECT author_id, SUM(score) as score FROM (
        SELECT "authorId" as author_id, score FROM laureate_scores
        UNION ALL
        SELECT "authorId" as author_id, score FROM genre_scores
        UNION ALL
        SELECT "authorId" as author_id, score FROM follower_scores
      ) t
      GROUP BY author_id
    )
    SELECT ad.*,
      COALESCE((SELECT json_agg(json_build_object('userId', ua."userId", 'authorId', ua."authorId", 'addedAt', ua."addedAt")) FROM "UserAuthor" ua WHERE ua."authorId" = ad.id AND ua."userId" = ${userId}::uuid), '[]'::json) as users,
      json_build_object(
        'quotes', (SELECT COUNT(*) FROM "Quote" q WHERE q."authorId" = ad.id)::int,
        'followers', (SELECT COUNT(*) FROM "UserAuthor" ua WHERE ua."authorId" = ad.id)::int
      ) as "_count",
      COALESCE((
        SELECT json_agg(sa_res) FROM (
          SELECT S.id, S.name, S.image, S."inventaireUri", S.description, S.nationality,
                 (COALESCE(cs.score, 0) + (CASE WHEN S.nationality IS NOT NULL AND ad.nationality IS NOT NULL AND S.nationality = ad.nationality THEN 3 ELSE 0 END))::int as score
          FROM "Author" S
          LEFT JOIN combined_scores cs ON cs.author_id = S.id
          WHERE S.id != ad.id
          ORDER BY score DESC, S.name ASC
          LIMIT 10
        ) sa_res
      ), '[]'::json) as "similarAuthors"
    FROM "Author" ad
    WHERE ad.id = ${id} LIMIT 1
  `;
}

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/authors/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  // patterns: [], ['by-name', name], [id], [id, 'books'], [id, 'notable-works'], [id, 'enrich'], [id, 'toggle-save']

  const user = await getAuthUser(req);
  const userId = user?.id ?? null;

  try {
    // GET /authors
    if (req.method === 'GET' && parts.length === 0) {
      const authors = await sql`
        SELECT a.*,
          COALESCE((SELECT json_agg(json_build_object('userId', ua."userId", 'authorId', ua."authorId", 'addedAt', ua."addedAt")) FROM "UserAuthor" ua WHERE ua."authorId" = a.id AND ua."userId" = ${userId}::uuid), '[]'::json) as users,
          json_build_object(
            'quotes', (SELECT COUNT(*) FROM "Quote" q WHERE q."authorId" = a.id)::int,
            'followers', (SELECT COUNT(*) FROM "UserAuthor" ua WHERE ua."authorId" = a.id)::int
          ) as "_count"
        FROM "Author" a
        ORDER BY a.name
      `;
      return json(authors.map((a: any) => formatAuthor(a, userId)));
    }

    // GET /authors/by-name/:name
    if (req.method === 'GET' && parts[0] === 'by-name' && parts[1]) {
      const name = decodeURIComponent(parts[1]);
      
      // ✅ CORRECTION: Exiger authentification pour la création d'auteur
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;
      
      // ✅ CORRECTION: Valider le nom d'auteur
      if (!name || name.length < 2 || name.length > 200) {
        return error('Invalid author name: must be between 2 and 200 characters', 400);
      }
      
      // ✅ CORRECTION: Recherche insensible à la casse et aux espaces
      let authorRows = await sql`
        WITH author_detail AS (
          SELECT id, nationality FROM "Author" WHERE LOWER(TRIM(name)) = LOWER(TRIM(${name})) LIMIT 1
        ),
        laureate_scores AS (
          SELECT l2."authorId", COUNT(*)*8 as score
          FROM "Laureate" l1
          JOIN "Laureate" l2 ON l1."prizeId" = l2."prizeId"
          WHERE l1."authorId" = (SELECT id FROM author_detail)
          GROUP BY l2."authorId"
        ),
        genre_scores AS (
          SELECT b2."authorId", COUNT(*)*5 as score
          FROM "Book" b1
          JOIN "Book" b2 ON b1.genre = b2.genre
          WHERE b1."authorId" = (SELECT id FROM author_detail)
            AND b1.genre IS NOT NULL AND b1.genre != '' AND b1.genre != 'Unknown'
          GROUP BY b2."authorId"
        ),
        follower_scores AS (
          SELECT ua2."authorId", COUNT(*)*4 as score
          FROM "UserAuthor" ua1
          JOIN "UserAuthor" ua2 ON ua1."userId" = ua2."userId"
          WHERE ua1."authorId" = (SELECT id FROM author_detail)
          GROUP BY ua2."authorId"
        ),
        combined_scores AS (
          SELECT author_id, SUM(score) as score FROM (
            SELECT "authorId" as author_id, score FROM laureate_scores
            UNION ALL
            SELECT "authorId" as author_id, score FROM genre_scores
            UNION ALL
            SELECT "authorId" as author_id, score FROM follower_scores
          ) t
          GROUP BY author_id
        )
        SELECT ad.*,
          COALESCE((SELECT json_agg(json_build_object('userId', ua."userId", 'authorId', ua."authorId", 'addedAt', ua."addedAt")) FROM "UserAuthor" ua WHERE ua."authorId" = ad.id AND ua."userId" = ${userId}::uuid), '[]'::json) as users,
          json_build_object(
            'quotes', (SELECT COUNT(*) FROM "Quote" q WHERE q."authorId" = ad.id)::int,
            'followers', (SELECT COUNT(*) FROM "UserAuthor" ua WHERE ua."authorId" = ad.id)::int
          ) as "_count",
          COALESCE((
            SELECT json_agg(sa_res) FROM (
              SELECT S.id, S.name, S.image, S."inventaireUri", S.description, S.nationality,
                     (COALESCE(cs.score, 0) + (CASE WHEN S.nationality IS NOT NULL AND ad.nationality IS NOT NULL AND S.nationality = ad.nationality THEN 3 ELSE 0 END))::int as score
              FROM "Author" S
              LEFT JOIN combined_scores cs ON cs.author_id = S.id
              WHERE S.id != ad.id
              ORDER BY score DESC, S.name ASC
              LIMIT 10
            ) sa_res
          ), '[]'::json) as "similarAuthors"
        FROM "Author" ad
        WHERE ad.id = (SELECT id FROM author_detail) LIMIT 1
      `;

      if (!authorRows.length) {
        // Activer pg_trgm si nécessaire pour la détection de similarité
        await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.catch(() => {});

        // Recherche par similarité pour éviter les doublons
        const similarAuthors = await sql`
          SELECT a.*, SIMILARITY(LOWER(a.name), LOWER(${name})) as similarity
          FROM "Author" a
          WHERE LOWER(a.name) % LOWER(${name})
          ORDER BY similarity DESC
          LIMIT 3
        `;

        if (similarAuthors.length > 0 && similarAuthors[0].similarity > 0.8) {
          // Utiliser l'auteur similaire existant si la similarité est élevée
          const matchedId = similarAuthors[0].id;
          authorRows = await getAuthorDetails(matchedId, userId);
        } else {
          // Créer un nouvel auteur avec le nom nettoyé
          const created = await sql`
            INSERT INTO "Author" (name) VALUES (${name.trim()}) RETURNING *
          `;
          const newAuthorId = created[0].id;
          
          // Synchronous profile enrichment (fast, skips discovery)
          const author = await enrichAuthorWithInventaire(newAuthorId, undefined, undefined, true);
          
          // Background discovery (slow)
          if (author?.inventaireUri) {
            // Set isEnriching to true in DB before launching background discovery to avoid race conditions
            await sql`UPDATE "Author" SET "isEnriching" = true WHERE id = ${newAuthorId}`.catch(() => {});
            waitUntil(discoverAuthorWorks(newAuthorId, author.inventaireUri));
          }
          
          authorRows = await getAuthorDetails(newAuthorId, userId);
        }
      }

      if (!authorRows.length) return error('Author not found', 404);
      const a = authorRows[0];

      const needsProfileEnrichment = a.inventaireUri && (!a.description || a.description.length < 200 || !a.image);
      const needsDiscovery = a.inventaireUri && !a.lastDiscoveredAt;

      if (needsProfileEnrichment || needsDiscovery) {
        a.isEnriching = true;
        console.log(`[authors] Triggering background enrichment/discovery for author ${a.id}`);
        if (needsProfileEnrichment) {
          waitUntil(enrichAuthorWithInventaire(a.id));
        } else {
          await sql`UPDATE "Author" SET "isEnriching" = true WHERE id = ${a.id}`.catch(() => {});
          waitUntil(discoverAuthorWorks(a.id, a.inventaireUri));
        }
      }

      return json(formatAuthor(a, userId));
    }

    const idParam = parts[0] && !isNaN(Number(parts[0])) ? parseInt(parts[0]) : null;
    const subAction = parts[1];

    // GET /authors/:id/books
    if (req.method === 'GET' && idParam && subAction === 'books') {
      let books = await sql`
        SELECT b.*,
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
        FROM "Book" b WHERE b."authorId" = ${idParam} ORDER BY b.year DESC
      `;
      if (books.length <= 1) {
        const authorRows = await sql`SELECT * FROM "Author" WHERE id = ${idParam} LIMIT 1`;
        if (authorRows.length) {
          // Synchronous profile enrichment (fast, skips discovery)
          const author = await enrichAuthorWithInventaire(authorRows[0].id, undefined, undefined, true);
          
          // Background discovery (slow)
          if (author?.inventaireUri) {
            await sql`UPDATE "Author" SET "isEnriching" = true WHERE id = ${authorRows[0].id}`.catch(() => {});
            waitUntil(discoverAuthorWorks(authorRows[0].id, author.inventaireUri));
          }
          
          books = await sql`
            SELECT b.*,
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
            FROM "Book" b WHERE b."authorId" = ${idParam} ORDER BY b.year DESC
          `;
        }
      }
      return json(books.map((b: any) => formatBook(b)));
    }

    // GET /authors/:id/external-books
    if (req.method === 'GET' && idParam && subAction === 'external-books') {
      const authorRows = await sql`SELECT name FROM "Author" WHERE id = ${idParam} LIMIT 1`;
      if (!authorRows.length) return error('Author not found', 404);
      const authorName = authorRows[0].name;

      const { searchGoogleBooks } = await import('../_shared/googlebooks.ts');
      try {
        const googleResults = await searchGoogleBooks(`inauthor:"${authorName}"`, 20, true);
        
        // Try to fetch richer metadata for books missing cover/description by searching their exact title
        const incompleteBooksToEnrich = googleResults.filter(b => !b.cover || !b.description);
        if (incompleteBooksToEnrich.length > 0) {
          const normalizeText = (t: string) =>
            t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();

          const enrichPromises = incompleteBooksToEnrich.slice(0, 8).map(async (book) => {
            try {
              const exactTitleQuery = `"${book.title}"`;
              const titleResults = await searchGoogleBooks(exactTitleQuery, 8, false);
              
              const normalizedBookTitle = normalizeText(book.title);

              // First try: same title + author matches
              let bestMatch = titleResults.find(r =>
                normalizeText(r.title) === normalizedBookTitle &&
                r.authors.some(a =>
                  a.toLowerCase().includes(authorName.toLowerCase()) ||
                  authorName.toLowerCase().includes(a.toLowerCase())
                ) &&
                (r.cover || r.description)
              );

              // Fallback: same title, any result with richer data (cover or description)
              // This handles the case where two Google Books entries exist for the same book,
              // and the richer one isn't linked to the author.
              if (!bestMatch) {
                bestMatch = titleResults
                  .filter(r => normalizeText(r.title) === normalizedBookTitle && (r.cover || r.description))
                  .sort((a, b) => {
                    // Prioritize entries with both cover and description
                    const scoreA = (a.cover ? 2 : 0) + (a.description ? 1 : 0);
                    const scoreB = (b.cover ? 2 : 0) + (b.description ? 1 : 0);
                    return scoreB - scoreA;
                  })[0] ?? null;
              }

              if (bestMatch) {
                // Merge all missing fields from the richer entry
                if (!book.cover && bestMatch.cover) {
                  book.cover = bestMatch.cover;
                  book.image = bestMatch.cover;
                }
                if (!book.description && bestMatch.description) {
                  book.description = bestMatch.description;
                }
                if ((!book.pages || book.pages === 0) && bestMatch.pages) {
                  book.pages = bestMatch.pages;
                }
                if (!book.isbn && bestMatch.isbn) {
                  book.isbn = bestMatch.isbn;
                }
                if ((!book.year || book.year === 0) && bestMatch.year) {
                  book.year = bestMatch.year;
                }
                console.log(`[authors] Enriched "${book.title}" with richer Google Books entry (cover: ${!!book.cover}, desc: ${!!book.description})`);
              }
            } catch (err) {
              console.warn(`[authors] Metadata enrichment failed for "${book.title}":`, err);
            }
          });
          await Promise.all(enrichPromises);
        }

        return json(googleResults);
      } catch (e: any) {
        console.error('[authors] Failed to fetch external books from Google Books:', e);
        return error(e.message || 'Failed to fetch from Google Books', 502);
      }
    }

    // GET /authors/:id/notable-works
    // Returns books marked isNotable=true in DB (set during author enrichment).
    // Fast SQL-only query — no live calls to Wikidata or Inventaire.
    if (req.method === 'GET' && idParam && subAction === 'notable-works') {
      const notableBooks = await sql`
        SELECT b.*, row_to_json(a) as author FROM "Book" b
        LEFT JOIN "Author" a ON a.id = b."authorId"
        WHERE b."authorId" = ${idParam} AND b."isNotable" = true
        ORDER BY b.year ASC
      `;
      return json(notableBooks.map((b: Record<string, unknown>) => formatBook(b)));
    }

    // POST /authors/:id/enrich
    if (req.method === 'POST' && idParam && subAction === 'enrich') {
      const authorRows = await sql`SELECT * FROM "Author" WHERE id = ${idParam} LIMIT 1`;
      if (!authorRows.length) return error('Author not found', 404);
      
      const updatedAuthor = await enrichAuthorWithInventaire(authorRows[0].id);
      
      let finalAuthor = null;
      if (updatedAuthor) {
        const enrichedRows = await getAuthorDetails(idParam, userId);
        if (enrichedRows.length) {
          finalAuthor = enrichedRows[0];
        }
      }
      
      const books = await sql`SELECT * FROM "Book" WHERE "authorId" = ${idParam} ORDER BY year DESC`;
      
      return json({ 
        success: true, 
        author: finalAuthor ? formatAuthor(finalAuthor, userId) : null,
        books: books.map((b: any) => formatBook(b)) 
      });
    }

    // POST /authors/:id/toggle-save
    if (req.method === 'POST' && idParam && subAction === 'toggle-save') {
      const authUser = await requireAuth(req);
      if (authUser instanceof Response) return authUser;

      const existing = await sql`
        SELECT 1 FROM "UserAuthor" WHERE "userId" = ${authUser.id} AND "authorId" = ${idParam} LIMIT 1
      `;
      let isSaved = false;
      if (existing.length) {
        await sql`DELETE FROM "UserAuthor" WHERE "userId" = ${authUser.id} AND "authorId" = ${idParam}`;
        isSaved = false;
      } else {
        await sql`INSERT INTO "UserAuthor" ("userId", "authorId", "addedAt") VALUES (${authUser.id}, ${idParam}, now())`;
        isSaved = true;
      }

      const countRows = await sql`
        SELECT COUNT(*)::int as count FROM "UserAuthor" WHERE "authorId" = ${idParam}
      `;
      const followersCount = countRows[0]?.count ?? 0;

      return json({ isSaved, followersCount });
    }

    // GET /authors/:id
    if (req.method === 'GET' && idParam && !subAction) {
      const authorRows = await getAuthorDetails(idParam, userId);
      if (!authorRows.length) return error('Author not found', 404);
      const author = authorRows[0];

      const needsProfileEnrichment = author.inventaireUri && (!author.description || author.description.length < 200 || !author.image);
      const needsDiscovery = author.inventaireUri && !author.lastDiscoveredAt;

      if (needsProfileEnrichment || needsDiscovery) {
        author.isEnriching = true;
        console.log(`[authors] Triggering background enrichment/discovery for author ${idParam}`);
        if (needsProfileEnrichment) {
          waitUntil(enrichAuthorWithInventaire(idParam));
        } else {
          await sql`UPDATE "Author" SET "isEnriching" = true WHERE id = ${idParam}`.catch(() => {});
          waitUntil(discoverAuthorWorks(idParam, author.inventaireUri));
        }
      }

      return json(formatAuthor(author, userId));
    }

    return error('Not found', 404);
  } catch (e: any) {
    console.error('[authors] TOP-LEVEL CRASH:', e);
    return error(JSON.stringify({ error: e.message, stack: e.stack }), 500);
  }
});
