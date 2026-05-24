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
import {
  enrichAuthorWithInventaire,
} from '../_shared/inventaire.ts';
import { getNotableWorksDetailed } from '../_shared/notableWorks.ts';
import { enrichBookWithInventaire } from '../_shared/bookEnrichment.ts';

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
          COALESCE((SELECT json_agg(ua) FROM "UserAuthor" ua WHERE ua."authorId" = a.id AND ua."userId" = ${userId}::uuid), '[]'::json) as users,
          json_build_object('quotes', (SELECT COUNT(*) FROM "Quote" q WHERE q."authorId" = a.id)::int) as "_count"
        FROM "Author" a
        ORDER BY a.name
      `;
      return json(authors.map((a: any) => formatAuthor(a, userId)));
    }

    // GET /authors/by-name/:name
    if (req.method === 'GET' && parts[0] === 'by-name' && parts[1]) {
      const name = decodeURIComponent(parts[1]);
      let authorRows = await sql`
        SELECT a.*,
          json_build_object('quotes', (SELECT COUNT(*) FROM "Quote" q WHERE q."authorId" = a.id)::int) as "_count"
        FROM "Author" a WHERE a.name = ${name} LIMIT 1
      `;

      if (!authorRows.length) {
        const created = await sql`
          INSERT INTO "Author" (name) VALUES (${name}) RETURNING *
        `;
        const newAuthorId = created[0].id;
        await enrichAuthorWithInventaire(newAuthorId);
        authorRows = await sql`
          SELECT a.*,
            json_build_object('quotes', (SELECT COUNT(*) FROM "Quote" q WHERE q."authorId" = a.id)::int) as "_count"
          FROM "Author" a WHERE a.id = ${newAuthorId} LIMIT 1
        `;
      }

      if (!authorRows.length) return error('Author not found', 404);
      const a = authorRows[0];
      return json({ ...a, quotesCount: (a._count as any).quotes });
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
          await enrichAuthorWithInventaire(authorRows[0].id);
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

    // GET /authors/:id/notable-works
    if (req.method === 'GET' && idParam && subAction === 'notable-works') {
      const authorRows = await sql`SELECT * FROM "Author" WHERE id = ${idParam} LIMIT 1`;
      if (!authorRows.length) return error('Author not found', 404);
      const author = authorRows[0];

      const notableWorks = await getNotableWorksDetailed(author.name);
      if (!notableWorks.length) return json([]);

      const results = [];
      for (const work of notableWorks) {
        let bookRows = await sql`
          SELECT b.*, row_to_json(a) as author FROM "Book" b
          LEFT JOIN "Author" a ON a.id = b."authorId"
          WHERE b."inventaireUri" = ${work.uri}
          OR (b.title = ${work.title} AND b."authorId" = ${idParam})
          LIMIT 1
        `;

        if (!bookRows.length) {
          bookRows = await sql`
            INSERT INTO "Book" (title, "authorId", "inventaireUri", genre, description)
            VALUES (${work.title}, ${idParam}, ${work.uri}, '', '')
            RETURNING *, (SELECT row_to_json(a) FROM "Author" a WHERE a.id = ${idParam}) as author
          `;
        }

        const book = bookRows[0];
        results.push(formatBook(book));

        if (book.inventaireUri && (!book.description || book.description.length < 50 || !book.cover)) {
          // @ts-ignore deno
          if (typeof EdgeRuntime !== 'undefined') {
            // @ts-ignore deno
            EdgeRuntime.waitUntil(enrichBookWithInventaire(book.id));
          }
        }
      }
      return json(results);
    }

    // POST /authors/:id/enrich
    if (req.method === 'POST' && idParam && subAction === 'enrich') {
      const authorRows = await sql`SELECT * FROM "Author" WHERE id = ${idParam} LIMIT 1`;
      if (!authorRows.length) return error('Author not found', 404);
      
      const updatedAuthor = await enrichAuthorWithInventaire(authorRows[0].id);
      const books = await sql`SELECT * FROM "Book" WHERE "authorId" = ${idParam} ORDER BY year DESC`;
      
      return json({ 
        success: true, 
        author: updatedAuthor ? formatAuthor(updatedAuthor, userId) : null,
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
      if (existing.length) {
        await sql`DELETE FROM "UserAuthor" WHERE "userId" = ${authUser.id} AND "authorId" = ${idParam}`;
        return json({ isSaved: false });
      } else {
        await sql`INSERT INTO "UserAuthor" ("userId", "authorId", "addedAt") VALUES (${authUser.id}, ${idParam}, now())`;
        return json({ isSaved: true });
      }
    }

    // GET /authors/:id
    if (req.method === 'GET' && idParam && !subAction) {
      const authorRows = await sql`
        SELECT a.*,
          COALESCE((SELECT json_agg(ua) FROM "UserAuthor" ua WHERE ua."authorId" = a.id AND ua."userId" = ${userId}::uuid), '[]'::json) as users,
          json_build_object('quotes', (SELECT COUNT(*) FROM "Quote" q WHERE q."authorId" = a.id)::int) as "_count"
        FROM "Author" a WHERE a.id = ${idParam} LIMIT 1
      `;
      if (!authorRows.length) return error('Author not found', 404);
      const author = authorRows[0];

      // Trigger background enrichment if data is sparse
      if (author.inventaireUri && (!author.description || !author.image)) {
        // @ts-ignore deno
        if (typeof EdgeRuntime !== 'undefined') {
          console.log(`[authors] Triggering background enrichment for author ${idParam}`);
          // @ts-ignore deno
          EdgeRuntime.waitUntil(enrichAuthorWithInventaire(idParam));
        }
      }

      return json(formatAuthor(author, userId));
    }

    return error('Not found', 404);
  } catch (e) {
    console.error('[authors]', e);
    return error('Internal server error');
  }
});
