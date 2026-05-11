/**
 * bookEnrichment.ts — Ported from server/src/services/bookEnrichment.ts
 * Prisma replaced with postgres.js.
 */
import { sql } from './db.ts';
import {
  enrichWorkMetadata,
  enrichAuthorWithInventaire,
  findWorkUriByTitleAndAuthor,
  mergeBooks,
} from './inventaire.ts';

export const bookEnrichmentQueue: Set<number> = new Set();

export const enrichBookWithInventaire = async (bookId: number): Promise<any | null> => {
  if (bookEnrichmentQueue.has(bookId)) {
    console.log(`[BookEnrichment] Already in queue for book ${bookId}. Skipping.`);
    return null;
  }
  bookEnrichmentQueue.add(bookId);
  console.log(`[BookEnrichment] Queue add: ${bookId} (size: ${bookEnrichmentQueue.size})`);
  try {
    return await enrichBookWithInventaireInternal(bookId);
  } finally {
    bookEnrichmentQueue.delete(bookId);
  }
};

const enrichBookWithInventaireInternal = async (bookId: number): Promise<any | null> => {
  try {
    await sql`UPDATE "Book" SET "isEnriching" = true WHERE id = ${bookId}`.catch(() => {});
    const bookRows = await sql`SELECT * FROM "Book" WHERE id = ${bookId} LIMIT 1`;
    const book = bookRows[0];
    if (!book) {
      console.error(`[BookEnrichment] Book ID ${bookId} not found in database.`);
      return null;
    }
    if (!book.inventaireUri) {
      console.warn(`[BookEnrichment] Book ${bookId} ("${book.title}") has no inventaireUri. Skipping detailed enrichment.`);
      return null;
    }

    console.log(`[BookEnrichment] Fetching metadata from Inventaire for URI: ${book.inventaireUri}`);
    const enriched = await enrichWorkMetadata(book.inventaireUri);
    console.log(`[BookEnrichment] Inventaire returned: ${enriched ? 'Data found' : 'No data'}`);

    if (enriched) {
      const updateData: Record<string, any> = {};

      // Title standardization / merge
      if (enriched.title && book.title !== enriched.title) {
        console.log(`✨ [BookEnrichment] Title correction for book ${bookId}: "${book.title}" -> "${enriched.title}"`);
        const targetRows = await sql`
          SELECT id, "inventaireUri" FROM "Book"
          WHERE title = ${enriched.title} AND "authorId" = ${book.authorId} AND id != ${bookId}
          LIMIT 1
        `;
        if (targetRows.length > 0) {
          console.log(`🔗 [BookEnrichment] Merging book ${bookId} into existing book ${targetRows[0].id} ("${enriched.title}")`);
          await mergeBooks(bookId, targetRows[0].id);
          if (!targetRows[0].inventaireUri) {
            await sql`UPDATE "Book" SET "inventaireUri" = ${book.inventaireUri} WHERE id = ${targetRows[0].id}`.catch(() => {});
          }
          return true;
        }
        updateData.title = enriched.title;
      }

      if (enriched.description) updateData.description = enriched.description;
      if (enriched.pages && (!book.pages || book.pages === 0)) updateData.pages = enriched.pages;
      if (enriched.year && (!book.year || book.year === 0)) updateData.year = enriched.year;

      if (enriched.image) {
        const currentIsWiki = !book.cover || book.cover.includes('wikimedia.org');
        const newIsInternal = enriched.image.includes('/img/entities/');
        if (!book.cover || (currentIsWiki && newIsInternal)) {
          updateData.cover = enriched.image;
        }
      }

      if (Object.keys(updateData).length > 0) {
        console.log(`[BookEnrichment] Updating book ${bookId} with ${Object.keys(updateData).join(', ')}`);
        await sql`UPDATE "Book" SET ${sql(updateData)} WHERE id = ${bookId}`;
      }

      // Upsert editions
      if (enriched.editions && Array.isArray(enriched.editions)) {
        for (const ed of enriched.editions) {
          await sql`
            INSERT INTO "Edition" ("inventaireUri", isbn, title, "publishDate", "publisherUri", "languageUri", cover, "bookId")
            VALUES (${ed.inventaireUri}, ${ed.isbn ?? null}, ${ed.title ?? null}, ${ed.publishDate ?? null},
                    ${ed.publisherUri ?? null}, ${ed.languageUri ?? null}, ${ed.cover ?? null}, ${bookId})
            ON CONFLICT ("inventaireUri") DO UPDATE SET
              isbn = EXCLUDED.isbn, title = EXCLUDED.title, "publishDate" = EXCLUDED."publishDate",
              "publisherUri" = EXCLUDED."publisherUri", "languageUri" = EXCLUDED."languageUri",
              cover = EXCLUDED.cover, "bookId" = EXCLUDED."bookId"
          `.catch((err: any) => console.error(`[BookEnrichment] Edition upsert failed:`, err));
        }
      }

      // Trigger author enrichment
      if (enriched.authorUris && Array.isArray(enriched.authorUris) && book.authorId) {
        for (const authorUri of enriched.authorUris) {
          console.log(`[BookEnrichment] Triggering linked author enrichment: ${authorUri}`);
          await enrichAuthorWithInventaire(book.authorId, undefined, authorUri, true).catch((e: any) =>
            console.error(`[BookEnrichment] Author enrichment failed:`, e)
          );
        }
      }

      console.log(`[BookEnrichment] Enrichment complete for book ${bookId} ("${enriched.title || book.title}")`);

      return true;
    }
    return null;
  } catch (e) {
    console.error(`[BookEnrichment] Error for book ${bookId}:`, e);
    return null;
  } finally {
    console.log(`[BookEnrichment] Final flag reset for book ${bookId}`);
    await sql`UPDATE "Book" SET "isEnriching" = false WHERE id = ${bookId}`.catch(() => {});
  }
};

export const discoverAndEnrichBook = async (bookId: number): Promise<void> => {
  if (bookEnrichmentQueue.has(bookId)) {
    console.log(`[BookEnrichment/Discovery] Already in queue for book ${bookId}. Skipping.`);
    return;
  }
  bookEnrichmentQueue.add(bookId);

  try {
    await sql`UPDATE "Book" SET "isEnriching" = true WHERE id = ${bookId}`.catch(() => {});
    const rows = await sql`
      SELECT b.*, row_to_json(a) as author FROM "Book" b
      LEFT JOIN "Author" a ON a.id = b."authorId"
      WHERE b.id = ${bookId}
      LIMIT 1
    `;
    const book = rows[0];
    if (!book) {
      console.error(`[BookEnrichment/Discovery] Book ID ${bookId} not found in database.`);
      return;
    }

    if (book.inventaireUri) {
      await enrichBookWithInventaireInternal(bookId);
      return;
    }

    const authorName = (book.author as any)?.name || 'Unknown';
    console.log(`[BookEnrichment/Discovery] Searching URI for "${book.title}" by "${authorName}"`);
    const uri = await findWorkUriByTitleAndAuthor(book.title, authorName);
    console.log(`[BookEnrichment/Discovery] URI search result: ${uri || 'None'}`);

    if (uri) {
      console.log(`[BookEnrichment] Book "${book.title}" matched with URI: ${uri}`);
      const conflictRows = await sql`SELECT id FROM "Book" WHERE "inventaireUri" = ${uri} LIMIT 1`;
      if (conflictRows.length > 0 && conflictRows[0].id !== bookId) {
        console.log(`[BookEnrichment] URI ${uri} already exists for book ID ${conflictRows[0].id}. Merging...`);
        await mergeBooks(bookId, conflictRows[0].id);
        await enrichBookWithInventaire(conflictRows[0].id);
        return;
      }
      console.log(`[BookEnrichment] Saved URI ${uri} for book ${bookId}. Starting detailed enrichment.`);
      await sql`UPDATE "Book" SET "inventaireUri" = ${uri} WHERE id = ${bookId}`;
      
      try {
        await enrichBookWithInventaireInternal(bookId);
      } catch (err) {
        console.error(`[BookEnrichment] Detailed enrichment failed for ${bookId}, but URI was saved.`, err);
      }
    } else {
      console.log(`[BookEnrichment] No match found for book: "${book.title}" by ${authorName}`);
    }
  } catch (e) {
    console.error(`[BookEnrichment/Discovery] Error for book ${bookId}:`, e);
  } finally {
    console.log(`[BookEnrichment/Discovery] Final flag reset for book ${bookId}`);
    await sql`UPDATE "Book" SET "isEnriching" = false WHERE id = ${bookId}`.catch(() => {});
    bookEnrichmentQueue.delete(bookId);
  }
};
