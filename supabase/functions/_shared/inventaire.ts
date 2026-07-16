/**
 * inventaire.ts — Ported from server/src/services/inventaire.ts
 * Prisma replaced with postgres.js (sql tagged template).
 * Background enrichment uses EdgeRuntime.waitUntil().
 */
import { sql } from './db.ts';
import * as api from './inventaire.api.ts';
import { searchAuthorQid, getAuthorWorks } from './wikidata.ts';
import { authorEnrichmentService } from './authorProviders.ts';

export * from './inventaire.api.ts';

// Wrapper with Wikidata fallback for external imports
export const getInventaireAuthorDetails = (uri: string) => {
  return authorEnrichmentService.getAuthorDetails(uri);
};

// ─── Deduplication ───────────────────────────────────────────────────────────
export const activeAuthorEnrichments = new Map<number, Promise<any>>();
export const activeUriEnrichments = new Map<string, Promise<any>>();

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
      // ✅ CORRECTION: Configurer un timeout de transaction pour éviter les deadlocks prolongés
      await tx`SET LOCAL statement_timeout = '30s'`;
      
      // Lock both books in ID order to prevent deadlock
      const [lowId, highId] = sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
      const locked = await tx`
        SELECT id FROM "Book" 
        WHERE id IN (${lowId}, ${highId}) 
        FOR UPDATE
      `;
      if (locked.length < 2) {
        console.log(`[Inventaire] One of the books to merge (${sourceId} or ${targetId}) was already deleted/merged. Skipping.`);
        return;
      }

      // 0. Get target book details
      const targetRows = await tx`SELECT title FROM "Book" WHERE id = ${targetId} LIMIT 1`;
      const targetBookTitle = targetRows[0]?.title || null;

      // 1. Move library status
      const userBooks = await tx`SELECT * FROM "UserBook" WHERE "bookId" = ${sourceId}`;
      for (const ub of userBooks) {
        await tx`
          INSERT INTO "UserBook" ("userId", "bookId", "status", "addedViaQuote", "addedAt")
          VALUES (${ub.userId ?? ub.userid}, ${targetId}, ${ub.status}, ${ub.addedViaQuote ?? false}, ${ub.addedAt})
          ON CONFLICT ("userId", "bookId") DO UPDATE SET
            "status" = COALESCE("UserBook".status, EXCLUDED.status),
            "addedViaQuote" = COALESCE("UserBook"."addedViaQuote", EXCLUDED."addedViaQuote")
        `;
      }

      // 2. Move relations
      await tx`UPDATE "Quote" SET "bookId" = ${targetId} WHERE "bookId" = ${sourceId}`;
      await tx`UPDATE "Review" SET "bookId" = ${targetId} WHERE "bookId" = ${sourceId}`;

      // 2.5 Update recommended books in Quote blockData JSON
      const quotesWithRecs = await tx`
        SELECT id, "blockData" FROM "Quote"
        WHERE "blockData" IS NOT NULL
      `;
      for (const q of quotesWithRecs) {
        let blockDataObj: Record<string, any> = {};
        try {
          blockDataObj = typeof q.blockData === 'string' ? JSON.parse(q.blockData) : q.blockData;
        } catch {
          continue;
        }
        if (blockDataObj && blockDataObj.recommendedBooks && Array.isArray(blockDataObj.recommendedBooks)) {
          let modified = false;
          blockDataObj.recommendedBooks = blockDataObj.recommendedBooks.map((b: any) => {
            if (b.id && Number(b.id) === Number(sourceId)) {
              modified = true;
              return {
                ...b,
                id: Number(targetId),
                title: targetBookTitle || b.title
              };
            }
            return b;
          });
          if (modified) {
            console.log(`[Inventaire] Updating recommended book reference in Quote ID ${q.id}: ${sourceId} → ${targetId}`);
            await tx`
              UPDATE "Quote"
              SET "blockData" = ${JSON.stringify(blockDataObj)}
              WHERE id = ${q.id}
            `;
          }
        }
      }

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
      // Lock both authors in ID order to prevent deadlock
      const [lowId, highId] = sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
      const locked = await tx`
        SELECT id FROM "Author" 
        WHERE id IN (${lowId}, ${highId}) 
        FOR UPDATE
      `;
      if (locked.length < 2) {
        console.log(`[Inventaire] One of the authors to merge (${sourceId} or ${targetId}) was already deleted/merged. Skipping.`);
        return;
      }

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
          SELECT 1 FROM "UserAuthor" WHERE "userId" = ${f.userId ?? f.userid} AND "authorId" = ${targetId} LIMIT 1
        `;
        if (!exists.length) {
          await tx`
            INSERT INTO "UserAuthor" ("userId", "authorId", "addedAt")
            VALUES (${f.userId ?? f.userid}, ${targetId}, ${f.addedAt})
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
  if (!details) {
    console.error(`[Inventaire] No details found for Work URI: ${uri}`);
    return null;
  }

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

  if (details.genreUris && details.genreUris.length > 0) {
    try {
      const genreEntities = await api.getInventaireEntities(details.genreUris);
      const genreLabels = details.genreUris.map(uri => {
        const entry = genreEntities[uri];
        const rawLabel = entry?.labels?.['fr'] || entry?.labels?.['en'] || (entry?.labels ? Object.values(entry.labels)[0] : null);
        return rawLabel ? rawLabel.replace(/\s*\(.*\)/g, '').trim() : null;
      }).filter(Boolean);
      if (genreLabels.length > 0) {
        result.genre = genreLabels.join(', ');
        console.log(`[Inventaire] Resolved genres for "${result.title || 'Unknown book'}": ${result.genre}`);
      }
    } catch (err) {
      console.error(`[Inventaire] Failed to fetch genre labels:`, err);
    }
  }

  if (details.wikipediaTitle) {
    const synopsis = await api.fetchWikipediaSynopsis(details.wikipediaTitle, 'fr');
    if (synopsis) {
      result.description = synopsis;
    }
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

export const syncAuthorProfile = (
  authorId: number,
  authorName?: string,
  authorUri?: string
): Promise<any> => {
  if (activeAuthorEnrichments.has(authorId)) {
    return activeAuthorEnrichments.get(authorId)!;
  }

  let resolvedUri: string | undefined = authorUri;

  const enrichmentContext = { promise: null as Promise<any> | null };
  const enrichmentPromise = (async () => {
    try {
      const author = await getAuthor(authorId);
      if (!author) {
        console.error(`[Inventaire] Author with ID ${authorId} not found in database.`);
        return null;
      }

      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const lastEnriched = author.lastEnrichedAt ? new Date(author.lastEnrichedAt).getTime() : 0;
      if (Date.now() - lastEnriched < SEVEN_DAYS) {
        console.log(`[Inventaire] Author ${author.name} recently enriched/attempted. Skipping.`);
        // Ensure isEnriching is false if it was set
        await sql`UPDATE "Author" SET "isEnriching" = false WHERE id = ${authorId}`.catch(() => {});
        return author;
      }

      await sql`UPDATE "Author" SET "isEnriching" = true, "lastEnrichedAt" = now() WHERE id = ${authorId}`.catch(() => {});


      const nameToSearch = authorName || author.name;
      let uri = authorUri || author.inventaireUri;

      // If we only have an inv: URI or no URI, try to see if we can find a better wd: one
      if (!uri || uri.startsWith('inv:')) {
        console.log(`[Inventaire] Searching for better URI for author: "${nameToSearch}" (Current: ${uri || 'none'})`);
        const searchResults = await api.searchInventaireAuthors(nameToSearch, 5);
        if (searchResults.length > 0) {
          // Filter results that actually match the author name
          const matchingResults = searchResults.filter(
            (r: any) => api.compareAuthorNames(r.label, nameToSearch)
          );

          if (matchingResults.length > 0) {
            // Prefer WD URI if available among matching results
            const bestMatch = matchingResults.find((r: any) => r.uri.startsWith('wd:')) || matchingResults[0];
            
            if (bestMatch.uri.startsWith('wd:') || !uri) {
              console.log(`[Inventaire] Selected best URI for "${nameToSearch}": ${bestMatch.uri} (replacing ${uri || 'none'})`);
              uri = bestMatch.uri;
            } else {
              console.log(`[Inventaire] Keeping existing URI for "${nameToSearch}": ${uri}`);
            }
          } else {
            console.log(`[Inventaire] No matching search results found for author: "${nameToSearch}" (checked ${searchResults.length} candidates, first was "${searchResults[0].label}")`);
          }
        } else {
          console.log(`[Inventaire] No search results found for author: "${nameToSearch}"`);
        }

        // Fallback: If we still don't have a valid wd: URI, try Wikidata's search API directly
        if (!uri || uri.startsWith('inv:')) {
          console.log(`[Inventaire] Fallback: Searching Wikidata directly for author: "${nameToSearch}"`);
          const wdResult = await searchAuthorQid(nameToSearch);
          if (wdResult && api.compareAuthorNames(wdResult.label, nameToSearch)) {
            const wikidataUri = `wd:${wdResult.id}`;
            console.log(`[Inventaire] Found Wikidata URI via fallback for "${nameToSearch}": ${wikidataUri} (${wdResult.label})`);
            uri = wikidataUri;
          } else if (wdResult) {
            console.log(`[Inventaire] Fallback found Wikidata result "${wdResult.label}" for "${nameToSearch}", but name comparison failed.`);
          } else {
            console.log(`[Inventaire] Fallback found no Wikidata results for "${nameToSearch}"`);
          }
        }
      }

      if (!uri) {
        console.warn(`[Inventaire] No URI (inventaire or wikidata) found for author ${nameToSearch} (ID: ${authorId})`);
        return null;
      }

      resolvedUri = uri;

      // URI deduplication: if another enrichment is processing this URI, await it
      const activeUriPromise = activeUriEnrichments.get(uri);
      if (activeUriPromise && activeUriPromise !== enrichmentContext.promise) {
        console.log(`[Inventaire] Awaiting active concurrent enrichment for URI ${uri}...`);
        await activeUriPromise;
        // After awaiting, this author might have been merged/deleted
        const freshAuthor = await getAuthor(authorId);
        if (!freshAuthor) {
          console.log(`[Inventaire] Author ${authorId} was merged/deleted during concurrent URI enrichment.`);
          const survivor = await sql`SELECT * FROM "Author" WHERE "inventaireUri" = ${uri} LIMIT 1`;
          return survivor[0] ?? null;
        }
        // Check conflict again
        const existingWithUri = await sql`SELECT * FROM "Author" WHERE "inventaireUri" = ${uri} LIMIT 1`;
        if (existingWithUri.length > 0 && existingWithUri[0].id !== authorId) {
          console.log(`[Inventaire] Conflict after awaiting concurrent URI enrichment: Author ${existingWithUri[0].id} already has URI ${uri}. Merging...`);
          await mergeAuthors(authorId, existingWithUri[0].id);
          return await syncAuthorProfile(existingWithUri[0].id, authorName, uri);
        }
      } else {
        if (enrichmentContext.promise) {
          activeUriEnrichments.set(uri, enrichmentContext.promise);
        }
      }

      // Check conflict
      const existingWithUri = await sql`SELECT * FROM "Author" WHERE "inventaireUri" = ${uri} LIMIT 1`;
      if (existingWithUri.length > 0 && existingWithUri[0].id !== authorId) {
        console.log(`[Inventaire] Conflict: Author ${existingWithUri[0].id} already has URI ${uri}. Merging...`);
        await mergeAuthors(authorId, existingWithUri[0].id);
        return await syncAuthorProfile(existingWithUri[0].id, authorName, uri);
      }

      const details = await authorEnrichmentService.getAuthorDetails(uri);
      if (!details) {
        console.error(`[Inventaire] Failed to fetch details from any provider for author URI: ${uri}`);
        return null;
      }

      const isNewEntity = uri !== author.inventaireUri;
      let biography = isNewEntity ? null : (author.description || null);

      if (details.wikipediaTitle && (!biography || biography.length < 200)) {
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
            "isVerified" = true,
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
            return await syncAuthorProfile(survivor[0].id, authorName, uri);
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
      if (resolvedUri) {
        activeUriEnrichments.delete(resolvedUri);
      }
      console.log(`[Inventaire] Final flag reset for author ${authorId}`);
      const exists = await sql`SELECT id FROM "Author" WHERE id = ${authorId} LIMIT 1`;
      if (exists.length) {
        await sql`UPDATE "Author" SET "isEnriching" = false WHERE id = ${authorId}`.catch(() => {});
      }
      activeAuthorEnrichments.delete(authorId);
    }
  })();

  enrichmentContext.promise = enrichmentPromise;
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

    // Ensure database records the isEnriching state
    await sql`UPDATE "Author" SET "isEnriching" = true WHERE id = ${authorId}`.catch(() => {});

    console.log(`[Inventaire] Starting discovery for author ${author.name} (${uri})`);
    let workUris: string[] = [];
    try {
      workUris = await api.getAuthorWorkUris(uri);
    } catch (e) {
      console.warn(`[Inventaire] Failed to fetch author work URIs from Inventaire for ${author.name}:`, e);
    }

    if (!workUris.length && uri.startsWith('wd:')) {
      console.log(`[Inventaire] Falling back to Wikidata SPARQL to discover works for QID: ${uri}`);
      try {
        const qid = uri.substring(3);
        const wdWorks = await getAuthorWorks(qid);
        console.log(`[Inventaire] Found ${wdWorks.length} works on Wikidata for author ${author.name}`);
        
        for (const w of wdWorks) {
          const wUri = `wd:${w.qid}`;
          const bookTitle = w.title.trim();
          let year = 0;
          if (w.date) {
            const match = w.date.match(/^(\d{4})/);
            if (match) year = parseInt(match[1]);
          }
          
          let cover = null;
          if (w.cover) {
            cover = w.cover.replace('http://', 'https://');
          }

          const existing = await sql`
            SELECT id, "inventaireUri", "openLibraryId" FROM "Book"
            WHERE "inventaireUri" = ${wUri}
            OR (title = ${bookTitle} AND "authorId" = ${authorId})
            LIMIT 1
          `;

          if (!existing.length) {
            try {
              await sql`
                INSERT INTO "Book" (title, "authorId", "inventaireUri", cover, year, description, genre, "openLibraryId")
                VALUES (${bookTitle}, ${authorId}, ${wUri}, ${cover}, ${year}, '', ${w.genres || ''}, ${w.openLibraryId || null})
              `;
            } catch (err) {
              const pgErr = err as { code?: string };
              if (pgErr.code !== '23505') console.error(`[Inventaire] Failed to create book ${bookTitle} from Wikidata fallback:`, err);
            }
          } else {
            const updates: Record<string, any> = {};
            if (!existing[0].inventaireUri) updates.inventaireUri = wUri;
            if (!existing[0].openLibraryId && w.openLibraryId) updates.openLibraryId = w.openLibraryId;
            
            if (Object.keys(updates).length > 0) {
              await sql`UPDATE "Book" SET ${sql(updates)} WHERE id = ${existing[0].id}`.catch(() => {});
            }
          }
        }
      } catch (wdErr) {
        console.error(`[Inventaire] Wikidata-based discovery failed for author ${author.name}:`, wdErr);
      }
    } else if (workUris.length > 0) {
      const limitedUris = workUris.slice(0, 50); // Reduced limit for safety
      const CHUNK_SIZE = 10; // Smaller chunks

      for (let i = 0; i < limitedUris.length; i += CHUNK_SIZE) {
        const chunk = limitedUris.slice(i, i + CHUNK_SIZE);
        
        // Fetch edition URIs in parallel for the current chunk of works
        const editionUrisPerWork = await Promise.all(
          chunk.map(async (wUri) => {
            let edUris: string[] = [];
            try {
              edUris = await api.getWorkEditionUris(wUri);
            } catch {
              // ignore individual errors
            }
            return { wUri, hasEditions: edUris.length > 0 };
          })
        );

        // Keep only works with at least one edition
        const filteredChunk = editionUrisPerWork
          .filter((x) => x.hasEditions)
          .map((x) => x.wUri);

        if (filteredChunk.length === 0) {
          console.log(`[Inventaire] No works in chunk ${i / CHUNK_SIZE + 1} have editions. Skipping chunk.`);
          continue;
        }

        console.log(
          `[Inventaire] Fetching details for works chunk ${i / CHUNK_SIZE + 1} (${filteredChunk.length}/${chunk.length} have editions)`
        );

        const [workEntities, bestCovers] = await Promise.all([
          api.getBatchInventaireDetails(filteredChunk).catch(() => ({})),
          api.getBestNativeCovers(filteredChunk).catch(() => ({} as Record<string, string | null>)),
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
            } catch (err) {
              const pgErr = err as { code?: string };
              if (pgErr.code !== '23505') console.error(`[Inventaire] Failed to create book ${bookTitle}:`, err);
            }
          } else if (!existing[0].inventaireUri) {
            await sql`UPDATE "Book" SET "inventaireUri" = ${wUri} WHERE id = ${existing[0].id}`.catch(() => {});
          }
        }
      }
    }

    console.log(`[Inventaire] Discovery complete for author ${author.name}`);
    await sql`UPDATE "Author" SET "lastDiscoveredAt" = now() WHERE id = ${authorId}`.catch(() => {});

    // ─── Mark notable works ───────────────────────────────────────────────────
    try {
      const { getNotableWorksDetailed } = await import('./notableWorks.ts');
      const notableWorks = await getNotableWorksDetailed(author.name);
      if (notableWorks.length > 0) {
        const notableUris = notableWorks.map((w: { uri: string; title: string }) => w.uri);
        const notableTitles = notableWorks.map((w: { uri: string; title: string }) => w.title.toLowerCase());

        // Reset all to false first, then mark the notable ones
        await sql`UPDATE "Book" SET "isNotable" = false WHERE "authorId" = ${authorId}`.catch(() => {});
        await sql`
          UPDATE "Book"
          SET "isNotable" = true
          WHERE "authorId" = ${authorId}
            AND (
              "inventaireUri" = ANY(${notableUris})
              OR LOWER(title) = ANY(${notableTitles})
            )
        `.catch(() => {});

        console.log(`[Inventaire] Marked notable works for author ${author.name} (${notableUris.length} P800 candidates)`);
      }
    } catch (notableErr) {
      console.error(`[Inventaire] Failed to mark notable works:`, notableErr);
    }
  } catch (e) {
    console.error(`[Inventaire] Author discovery error:`, e);
  } finally {
    // Always ensure the isEnriching flag is reset when done
    await sql`UPDATE "Author" SET "isEnriching" = false WHERE id = ${authorId}`.catch(() => {});
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
