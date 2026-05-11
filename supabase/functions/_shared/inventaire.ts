/**
 * inventaire.ts — Ported from server/src/services/inventaire.ts
 * Prisma replaced with postgres.js (sql tagged template).
 * Background enrichment uses EdgeRuntime.waitUntil().
 */
import { sql } from './db.ts';
import * as api from './inventaire.api.ts';

export * from './inventaire.api.ts';

// ─── Deduplication ───────────────────────────────────────────────────────────
export const activeAuthorEnrichments = new Map<number, Promise<any>>();

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function getBook(id: number) {
  const rows = await sql`SELECT * FROM "Book" WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

async function getBookWithAuthor(id: number) {
  const rows = await sql`
    SELECT b.*, row_to_json(a) as author
    FROM "Book" b
    LEFT JOIN "Author" a ON a.id = b."authorId"
    WHERE b.id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getAuthor(id: number) {
  const rows = await sql`SELECT * FROM "Author" WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

// ─── mergeBooks ───────────────────────────────────────────────────────────────

export async function mergeBooks(sourceId: number, targetId: number) {
  if (sourceId === targetId) return;
  console.log(`[Inventaire] Merging book ${sourceId} → ${targetId}`);
  try {
    await sql.begin(async (tx) => {
      // 1. Move library status
      const userBooks = await tx`SELECT * FROM "UserBook" WHERE "bookId" = ${sourceId}`;
      for (const ub of userBooks) {
        await tx`
          INSERT INTO "UserBook" ("userId", "bookId", "status", "addedAt")
          VALUES (${ub.userId}, ${targetId}, ${ub.status}, ${ub.addedAt})
          ON CONFLICT ("userId", "bookId") DO UPDATE SET
            "status" = COALESCE("UserBook".status, EXCLUDED.status)
        `;
      }
      // 2. Move relations
      await tx`UPDATE "Quote" SET "bookId" = ${targetId} WHERE "bookId" = ${sourceId}`;
      await tx`UPDATE "Review" SET "bookId" = ${targetId} WHERE "bookId" = ${sourceId}`;
      // 3. Delete source
      await tx`DELETE FROM "UserBook" WHERE "bookId" = ${sourceId}`;
      await tx`DELETE FROM "Book" WHERE id = ${sourceId}`;
    });
    console.log(`[Inventaire] Merge OK. Book ${sourceId} deleted.`);
  } catch (e) {
    console.error(`[Inventaire] Merge failed ${sourceId}→${targetId}:`, e);
    throw e;
  }
}

// ─── mergeAuthors ─────────────────────────────────────────────────────────────

export async function mergeAuthors(sourceId: number, targetId: number) {
  if (sourceId === targetId) return;
  console.log(`[Inventaire] Merging author ${sourceId} → ${targetId}`);
  try {
    await sql.begin(async (tx) => {
      // Move books
      const sourceBooks = await tx`SELECT * FROM "Book" WHERE "authorId" = ${sourceId}`;
      for (const book of sourceBooks) {
        const conflict = await tx`
          SELECT id FROM "Book"
          WHERE "authorId" = ${targetId}
          AND (title = ${book.title} ${book.inventaireUri ? sql`OR "inventaireUri" = ${book.inventaireUri}` : sql``})
          LIMIT 1
        `;
        if (conflict.length > 0) {
          // merge recursively inside transaction (simplified: just delete source)
          await tx`UPDATE "Quote" SET "bookId" = ${conflict[0].id} WHERE "bookId" = ${book.id}`;
          await tx`UPDATE "Review" SET "bookId" = ${conflict[0].id} WHERE "bookId" = ${book.id}`;
          await tx`DELETE FROM "Book" WHERE id = ${book.id}`;
        } else {
          await tx`UPDATE "Book" SET "authorId" = ${targetId} WHERE id = ${book.id}`;
        }
      }
      // Move quotes
      await tx`UPDATE "Quote" SET "authorId" = ${targetId} WHERE "authorId" = ${sourceId}`;
      // Move followers
      const sourceFollowers = await tx`SELECT * FROM "UserAuthor" WHERE "authorId" = ${sourceId}`;
      for (const f of sourceFollowers) {
        const exists = await tx`
          SELECT 1 FROM "UserAuthor" WHERE "userId" = ${f.userId} AND "authorId" = ${targetId} LIMIT 1
        `;
        if (!exists.length) {
          await tx`
            INSERT INTO "UserAuthor" ("userId", "authorId", "addedAt")
            VALUES (${f.userId}, ${targetId}, ${f.addedAt})
          `;
        }
      }
      await tx`DELETE FROM "Author" WHERE id = ${sourceId}`;
    });
    console.log(`[Inventaire] Author merge OK. Author ${sourceId} deleted.`);
  } catch (e) {
    console.error(`[Inventaire] Author merge failed:`, e);
    throw e;
  }
}

// ─── enrichWorkMetadata ───────────────────────────────────────────────────────

export const enrichWorkMetadata = async (uri: string): Promise<any> => {
  console.log(`[Inventaire] Starting enrichment for ${uri}`);
  const details = await api.getInventaireWorkDetails(uri);
  if (!details) return null;

  const nativeUri = details.uri;
  const result: any = {
    title: details.title,
    year: details.year,
    image: details.image,
    inventaireUri: nativeUri,
    authorUris: details.authorUris,
    wikipediaTitle: details.wikipediaTitle,
    description: null,
    pages: 0,
    authors: [],
  };

  if (details.authorUris.length > 0) {
    const authorEntities = await api.getInventaireEntities([details.authorUris[0]]);
    const authorEntry = authorEntities[details.authorUris[0]];
    if (authorEntry?.labels) {
      result.authors = [
        authorEntry.labels['fr'] || authorEntry.labels['en'] || Object.values(authorEntry.labels)[0],
      ];
    }
  }

  if (details.wikipediaTitle) {
    const synopsis = await api.fetchWikipediaSynopsis(details.wikipediaTitle, 'fr');
    if (synopsis) result.description = synopsis;
  }

  try {
    const searchMetadata = await api.getBatchInventaireSearchMetadata([uri]);
    if (api.isNativeScan(searchMetadata[uri]?.image)) result.image = searchMetadata[uri].image;

    const editions = await api.getWorkEditions(nativeUri);
    result.editions = editions;

    if (editions.length > 0) {
      const scored = editions.map((e: any) => {
        let score = 0;
        if (e.languageUri === 'wd:Q150') score += 10;
        if (e.cover?.includes('/img/entities/')) score += 5;
        if (e.isbn) score += 2;
        if (e.pages && e.pages > 0) score += 1;
        return { ed: e, score };
      }).sort((a: any, b: any) => b.score - a.score);

      const bestEd = scored[0].ed;
      if (bestEd.cover) result.image = bestEd.cover;

      const edWithPages = editions.find((e: any) => e.pages && e.pages > 0);
      if (edWithPages) result.pages = edWithPages.pages;

      if (!result.year) {
        const edWithYear = editions.find((e: any) => e.publishDate);
        if (edWithYear?.publishDate) result.year = parseInt(edWithYear.publishDate.substring(0, 4));
      }
    }
  } catch (err) {
    console.error(`[Inventaire] Failed to fetch editions:`, err);
  }

  return result;
};

// ─── syncAuthorProfile ────────────────────────────────────────────────────────

export const syncAuthorProfile = async (
  authorId: number,
  authorName?: string,
  authorUri?: string
): Promise<any> => {
  if (activeAuthorEnrichments.has(authorId)) {
    return activeAuthorEnrichments.get(authorId);
  }

  const enrichmentPromise = (async () => {
    try {
      await sql`UPDATE "Author" SET "isEnriching" = true WHERE id = ${authorId}`.catch(() => {});

      const author = await getAuthor(authorId);
      if (!author) return null;

      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const lastEnriched = author.lastEnrichedAt ? new Date(author.lastEnrichedAt).getTime() : 0;
      if (Date.now() - lastEnriched < SEVEN_DAYS && author.description && author.description.length > 50) {
        console.log(`[Inventaire] Author ${author.name} freshly enriched. Skipping.`);
        return author;
      }

      const nameToSearch = authorName || author.name;
      let uri = authorUri || author.inventaireUri;

      // If we only have an inv: URI or no URI, try to see if we can find a better wd: one
      if (!uri || uri.startsWith('inv:')) {
        console.log(`[Inventaire] Searching for better URI for author: "${nameToSearch}" (Current: ${uri || 'none'})`);
        const searchResults = await api.searchInventaireAuthors(nameToSearch, 5);
        if (searchResults.length > 0) {
          // Prefer WD URI if available among results with same name
          const bestMatch = searchResults.find(
            (r: any) => r.label.toLowerCase().trim() === nameToSearch.toLowerCase().trim() && r.uri.startsWith('wd:')
          ) || searchResults.find(
            (r: any) => r.label.toLowerCase().trim() === nameToSearch.toLowerCase().trim()
          ) || searchResults[0];
          
          if (bestMatch.uri.startsWith('wd:') || !uri) {
            console.log(`[Inventaire] Selected best URI for "${nameToSearch}": ${bestMatch.uri} (replacing ${uri || 'none'})`);
            uri = bestMatch.uri;
          } else {
            console.log(`[Inventaire] Keeping existing URI for "${nameToSearch}": ${uri}`);
          }
        } else {
          console.log(`[Inventaire] No search results found for author: "${nameToSearch}"`);
        }
      }

      if (!uri) return null;

      // Check conflict
      const existingWithUri = await sql`SELECT * FROM "Author" WHERE "inventaireUri" = ${uri} LIMIT 1`;
      if (existingWithUri.length > 0 && existingWithUri[0].id !== authorId) {
        console.log(`[Inventaire] Conflict: Author ${existingWithUri[0].id} already has URI ${uri}. Merging...`);
        await mergeAuthors(authorId, existingWithUri[0].id);
        return syncAuthorProfile(existingWithUri[0].id, authorName, uri);
      }

      const details = await api.getInventaireAuthorDetails(uri);
      if (!details) return null;

      const isNewEntity = uri !== author.inventaireUri;
      let biography = isNewEntity ? (details.description || null) : (author.description || details.description || null);

      if (details.wikipediaTitle && (!biography || biography.length < 100)) {
        console.log(`[Inventaire] Fetching Wikipedia synopsis for: ${details.wikipediaTitle}`);
        const synopsis = await api.fetchWikipediaSynopsis(details.wikipediaTitle, 'fr');
        if (synopsis) biography = synopsis;
      }

      const updateData: any = {
        inventaireUri: uri,
        description: biography,
        image: isNewEntity ? details.image : (details.image || author.image),
        birthDate: isNewEntity ? details.birthDate : (details.birthDate || author.birthDate),
        nationality: isNewEntity ? details.nationality : (details.nationality || author.nationality),
        lastEnrichedAt: new Date(),
      };

      // Resolve nationality URI
      if (updateData.nationality && (updateData.nationality.startsWith('wd:') || updateData.nationality.startsWith('inv:'))) {
        try {
          const natEntities = await api.getInventaireEntities([updateData.nationality]);
          const natEntity = natEntities[updateData.nationality];
          if (natEntity?.labels) {
            updateData.nationality = natEntity.labels['fr'] || natEntity.labels['en'] || Object.values(natEntity.labels)[0];
          }
        } catch {}
      }

      // Check name conflict
      if (details.name && author.name !== details.name) {
        console.log(`✨ [Inventaire] Author name corrected: "${author.name}" -> "${details.name}"`);
        const nameConflict = await sql`SELECT id FROM "Author" WHERE name = ${details.name} LIMIT 1`;
        if (!nameConflict.length) {
          updateData.name = details.name;
        } else {
          console.log(`⚠️ [Inventaire] Name "${details.name}" already taken by author ${nameConflict[0].id}. Skipping rename.`);
        }
      }

      let updatedAuthor;
      try {
        console.log(`[Inventaire] Updating DB for author ${authorId} with name: ${updateData.name || author.name}`);
        const rows = await sql`
          UPDATE "Author" SET
            "inventaireUri" = ${updateData.inventaireUri},
            description = ${updateData.description ?? null},
            image = ${updateData.image ?? null},
            "birthDate" = ${updateData.birthDate ?? null},
            nationality = ${updateData.nationality ?? null},
            "lastEnrichedAt" = ${updateData.lastEnrichedAt},
            ${updateData.name ? sql`name = ${updateData.name},` : sql``}
            "isEnriching" = false
          WHERE id = ${authorId}
          RETURNING *
        `;
        updatedAuthor = rows[0];
        console.log(`[Inventaire] DB Update successful for ${updatedAuthor?.name}`);
      } catch (err: any) {
        // Unique constraint on inventaireUri → race condition → merge
        if (err.code === '23505') {
          const survivor = await sql`SELECT * FROM "Author" WHERE "inventaireUri" = ${uri} LIMIT 1`;
          if (survivor.length) {
            await mergeAuthors(authorId, survivor[0].id);
            return syncAuthorProfile(survivor[0].id, authorName, uri);
          }
        }
        throw err;
      }

      console.log(`[Inventaire] Enrichment complete for ${updatedAuthor?.name}. Description length: ${updatedAuthor?.description?.length || 0}, Image: ${!!updatedAuthor?.image}`);
      return updatedAuthor;
    } catch (e) {
      console.error(`[Inventaire] Author enrichment error:`, e);
      return null;
    } finally {
      console.log(`[Inventaire] Final flag reset for author ${authorId}`);
      const exists = await sql`SELECT id FROM "Author" WHERE id = ${authorId} LIMIT 1`;
      if (exists.length) {
        await sql`UPDATE "Author" SET "isEnriching" = false WHERE id = ${authorId}`.catch(() => {});
      }
      activeAuthorEnrichments.delete(authorId);
    }
  })();

  activeAuthorEnrichments.set(authorId, enrichmentPromise);
  return enrichmentPromise;
};

// ─── discoverAuthorWorks ──────────────────────────────────────────────────────

export const discoverAuthorWorks = async (authorId: number, authorUri?: string): Promise<void> => {
  try {
    const author = await getAuthor(authorId);
    if (!author) return;

    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const lastDiscovered = author.lastDiscoveredAt ? new Date(author.lastDiscoveredAt).getTime() : 0;
    if (Date.now() - lastDiscovered < SEVEN_DAYS) return;

    const uri = authorUri || author.inventaireUri;
    if (!uri) {
      console.log(`[Inventaire] No URI for author ${authorId}, skipping discovery.`);
      return;
    }

    console.log(`[Inventaire] Starting discovery for author ${author.name} (${uri})`);
    const workUris = await api.getAuthorWorkUris(uri);
    console.log(`[Inventaire] Found ${workUris.length} works for author ${author.name}`);
    if (!workUris.length) return;

    const limitedUris = workUris.slice(0, 50); // Reduced limit for safety
    const CHUNK_SIZE = 10; // Smaller chunks

    for (let i = 0; i < limitedUris.length; i += CHUNK_SIZE) {
      const chunk = limitedUris.slice(i, i + CHUNK_SIZE);
      console.log(`[Inventaire] Fetching details for works chunk ${i/CHUNK_SIZE + 1}`);
      
      const [workEntities, bestCovers] = await Promise.all([
        api.getBatchInventaireDetails(chunk),
        api.getBestNativeCovers(chunk)
      ]);

      for (const [wUri, details] of Object.entries(workEntities)) {
        if (!details || !(details as any).title) continue;
        const bookTitle = ((details as any).title as string).trim();
        const finalCover = bestCovers[wUri] || (details as any).image || null;

        const existing = await sql`
          SELECT id, "inventaireUri" FROM "Book"
          WHERE "inventaireUri" = ${wUri}
          OR (title = ${bookTitle} AND "authorId" = ${authorId})
          LIMIT 1
        `;

        if (!existing.length) {
          try {
            await sql`
              INSERT INTO "Book" (title, "authorId", "inventaireUri", cover, year, description, genre)
              VALUES (${bookTitle}, ${authorId}, ${wUri}, ${finalCover}, ${(details as any).year ?? 0}, '', '')
            `;
          } catch (err: any) {
            if (err.code !== '23505') console.error(`[Inventaire] Failed to create book ${bookTitle}:`, err);
          }
        } else if (!existing[0].inventaireUri) {
          await sql`UPDATE "Book" SET "inventaireUri" = ${wUri} WHERE id = ${existing[0].id}`.catch(() => {});
        }
      }
    }

    console.log(`[Inventaire] Discovery complete for author ${author.name}`);
    await sql`UPDATE "Author" SET "lastDiscoveredAt" = now() WHERE id = ${authorId}`.catch(() => {});
  } catch (e) {
    console.error(`[Inventaire] Author discovery error:`, e);
  }
};

// ─── enrichAuthorWithInventaire (main export) ─────────────────────────────────

export const enrichAuthorWithInventaire = async (
  authorId: number,
  authorName?: string,
  authorUri?: string,
  skipDiscovery = false
): Promise<any> => {
  const author = await syncAuthorProfile(authorId, authorName, authorUri);
  if (!author) return null;
  if (!skipDiscovery && author.inventaireUri) {
    await discoverAuthorWorks(authorId, author.inventaireUri);
  }
  return author;
};
