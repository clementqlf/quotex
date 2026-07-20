/**
 * Edge Function: /sync-quotes
 * Handles synchronization of offline quotes when connection is restored
 * Only inserts if there's a match in Inventaire (French national library)
 * Uses corrected/canonical versions from Inventaire when available
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { sql } from '../_shared/db.ts';
import { matchAuthor, matchBook, AuthorMatchResult, BookMatchResult } from '../_shared/entityMatcher.ts';
import { searchInventaireAuthors, getInventaireWorkDetails, getInventaireAuthorDetails, enrichAuthorWithInventaire } from '../_shared/inventaire.ts';
import { bookSearchService } from '../_shared/bookProviders.ts';
import { enrichBookWithInventaire } from '../_shared/bookEnrichment.ts';
import { waitUntil } from '../_shared/waitUntil.ts';

interface OfflineQuote {
  id: string;
  text: string;
  author?: string;
  book?: string;
  theme?: string;
  createdAt: string;
  userId: string;
  idempotencyKey?: string;
}

interface SyncResult {
  quoteId: string;
  realQuoteId?: number;
  originalAuthor?: string;
  matchedAuthor?: string;
  originalBook?: string;
  matchedBook?: string;
  authorCreated?: boolean;
  bookCreated?: boolean;
  inventaireMatch?: boolean;
  inventaireUri?: string;
  matchSource?: 'local' | 'inventaire' | 'google-books';
  authorId?: number | null;
  bookId?: number | null;
}

interface InventaireMatch {
  authorUri?: string;
  authorName?: string;
  workUri?: string;
  workTitle?: string;
}

interface SequentialWorkMatch {
  source: 'inventaire' | 'google-books';
  workId?: string;
  workUri?: string;
  title: string;
  authorName: string;
  googleId?: string;
  cover?: string | null;
  description?: string | null;
  year?: number | null;
  pages?: number | null;
  genre?: string | null;
  metadataSources?: Record<string, string>;
}

// sequential match helper is now resolved via bookSearchService

/// <reference path="../_shared/edge-runtime.d.ts" />

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== 'POST') return error('Method not allowed', 405);

  // Verify authentication — reject unauthenticated requests
  const authUser = await requireAuth(req);
  if (authUser instanceof Response) return authUser;

  try {
    const { offlineQuotes } = await req.json();

    // Force userId from JWT token — never trust the body
    for (const quote of offlineQuotes) {
      quote.userId = authUser.id;
    }
    
    if (!offlineQuotes || !Array.isArray(offlineQuotes)) {
      return error('Missing or invalid offlineQuotes array', 400);
    }

    let syncedCount = 0;
    const errors: Array<{ quote: OfflineQuote; error: string }> = [];
    const syncResults: SyncResult[] = [];

    for (const offlineQuote of offlineQuotes) {
      try {
        // --- Idempotency check ---
        // If the client sends a stable op.id key, check if this quote was already inserted
        // on a previous retry. If so, skip all logic and return the existing row.
        if (offlineQuote.idempotencyKey) {
          const existing = await sql`
            SELECT id, "authorId", "bookId" FROM "Quote"
            WHERE "idempotencyKey" = ${offlineQuote.idempotencyKey}
            LIMIT 1
          `;
          if (existing.length > 0) {
            console.log(`[sync-quotes] Idempotency hit for key ${offlineQuote.idempotencyKey}: returning existing quote ${existing[0].id}`);
            syncResults.push({
              quoteId: offlineQuote.id,
              realQuoteId: existing[0].id,
              authorId: existing[0].authorId,
              bookId: existing[0].bookId,
            });
            syncedCount++;
            continue;
          }
        }

        // First, check if we have both author and book (required for Inventaire matching)
        if (!offlineQuote.author || !offlineQuote.book) {
          console.log(`[sync-quotes] Skipping quote ${offlineQuote.id}: missing author or book`);
          errors.push({ 
            quote: offlineQuote, 
            error: 'Missing author or book - cannot verify with Inventaire' 
          });
          continue;
        }

        // 1. Check DB first (without creating)
        let authorId: number | null = null;
        let authorLookup: AuthorMatchResult | null = null;
        let bookId: number | null = null;
        let bookLookup: BookMatchResult | null = null;

        if (offlineQuote.author) {
          authorLookup = await matchAuthor(offlineQuote.author, false);
          authorId = authorLookup?.id || null;
        }

        if (offlineQuote.book) {
          bookLookup = await matchBook(offlineQuote.book, authorId, false);
          bookId = bookLookup?.id || null;
        }

        // 2. If missing in DB, check Inventaire
        const inventaireMatch: InventaireMatch = {};
        let hasInventaireMatch = false;
        let matchSource: 'local' | 'inventaire' | 'google-books' = 'local';
        let workMatch: SequentialWorkMatch | null = null;

        if ((offlineQuote.author && !authorId) || (offlineQuote.book && !bookId)) {
          console.log(`🔍 [SyncQuotes] Matching external sources for: book="${offlineQuote.book}", author="${offlineQuote.author}"`);
          
          if (offlineQuote.book && offlineQuote.author) {
            const match = await bookSearchService.resolveSequentialMatch(offlineQuote.book, offlineQuote.author);
            if (match) {
              workMatch = {
                source: match.source === 'Inventaire' ? 'inventaire' : 'google-books',
                workId: match.id,
                workUri: match.source === 'Inventaire' ? match.uri : undefined,
                googleId: match.source === 'Google Books' ? match.id : match.googleId,
                title: match.title,
                authorName: match.authors[0] || offlineQuote.author,
                cover: match.cover,
                description: match.description,
                year: match.year,
                pages: match.pages,
                genre: match.genre,
                metadataSources: match.metadataSources,
              };
              hasInventaireMatch = true;
              inventaireMatch.workTitle = workMatch.title;
              inventaireMatch.authorName = workMatch.authorName;
              matchSource = workMatch.source;

              console.log(`✨ [SyncQuotes] Sequential match result: title="${workMatch.title}", year=${workMatch.year}, cover=${workMatch.cover ? 'YES' : 'NO'}, descLength=${workMatch.description?.length || 0}`);

              if (workMatch.source === 'inventaire' && workMatch.workUri) {
                inventaireMatch.workUri = workMatch.workUri;
                const workDetails = await getInventaireWorkDetails(workMatch.workUri);
                if (workDetails?.authorUris && workDetails.authorUris.length > 0) {
                  const authorDetails = await getInventaireAuthorDetails(workDetails.authorUris[0]);
                  if (authorDetails) {
                    inventaireMatch.authorUri = workDetails.authorUris[0];
                    inventaireMatch.authorName = authorDetails.name;
                  }
                }
              }
            } else {
              const authorResults = await searchInventaireAuthors(offlineQuote.author, 5);
              if (authorResults.length > 0) {
                inventaireMatch.authorUri = authorResults[0].uri;
                inventaireMatch.authorName = authorResults[0].label;
              }
            }
          } else if (offlineQuote.author && !offlineQuote.book) {
            const authorResults = await searchInventaireAuthors(offlineQuote.author, 5);
            if (authorResults.length > 0) {
              inventaireMatch.authorUri = authorResults[0].uri;
              inventaireMatch.authorName = authorResults[0].label;
            }
          }
        }

        // Use Inventaire canonical names and URIs for matching
        const finalAuthorName = inventaireMatch.authorName || offlineQuote.author;
        const finalBookTitle = inventaireMatch.workTitle || offlineQuote.book;

        // Log corrections if using Inventaire names
        if (offlineQuote.author && inventaireMatch.authorName && inventaireMatch.authorName !== offlineQuote.author) {
          console.log(`[sync-quotes] Using ${matchSource} author correction: "${offlineQuote.author}" -> "${finalAuthorName}"`);
        }
        if (offlineQuote.book && inventaireMatch.workTitle && inventaireMatch.workTitle !== offlineQuote.book) {
          console.log(`[sync-quotes] Using ${matchSource} book correction: "${offlineQuote.book}" -> "${finalBookTitle}"`);
        }

        // 3. Create missing entities (using Inventaire data if available)
        if (offlineQuote.author && !authorId) {
          if (inventaireMatch.authorUri) {
            const existingAuthor = await sql`SELECT id, name FROM "Author" WHERE "inventaireUri" = ${inventaireMatch.authorUri} LIMIT 1`;
            if (existingAuthor.length > 0) {
              authorId = existingAuthor[0].id;
              authorLookup = { id: authorId, name: existingAuthor[0].name, wasCreated: false, originalName: finalAuthorName! };
            }
          }
          
          if (!authorId) {
            authorLookup = await matchAuthor(finalAuthorName, true);
            authorId = authorLookup?.id || null;
            if (authorId && inventaireMatch.authorUri) {
              const checkRow = await sql`SELECT "inventaireUri" FROM "Author" WHERE id = ${authorId} LIMIT 1`;
              const currentUri = checkRow[0]?.inventaireUri;
              if (currentUri && currentUri !== inventaireMatch.authorUri) {
                // Si l'auteur trouvé a déjà un URI différent, c'est un homonyme.
                // On crée une nouvelle ligne d'auteur distincte pour le nouvel URI.
                const created = await sql`
                  INSERT INTO "Author" (name, "inventaireUri", "isEnriching", "isVerified")
                  VALUES (${finalAuthorName}, ${inventaireMatch.authorUri}, true, true)
                  RETURNING id, name
                `;
                authorId = created[0].id;
                authorLookup = { id: authorId, name: created[0].name, wasCreated: true, originalName: finalAuthorName! };
              } else {
                await sql`UPDATE "Author" SET "inventaireUri" = ${inventaireMatch.authorUri}, "isEnriching" = true, "isVerified" = true WHERE id = ${authorId}`;
              }
            }
          }
        }

        if (offlineQuote.book && !bookId) {
          if (inventaireMatch.workUri) {
            const existingBook = await sql`SELECT id, title FROM "Book" WHERE "inventaireUri" = ${inventaireMatch.workUri} LIMIT 1`;
            if (existingBook.length > 0) {
              bookId = existingBook[0].id;
              bookLookup = { id: bookId, title: existingBook[0].title, wasCreated: false, originalTitle: finalBookTitle! };
            }
          }
          
          if (!bookId) {
            bookLookup = await matchBook(finalBookTitle, authorId, true);
            bookId = bookLookup?.id || null;
            if (bookId && inventaireMatch.workUri) {
              await sql`UPDATE "Book" SET "inventaireUri" = ${inventaireMatch.workUri}, "isEnriching" = true, "isVerified" = true WHERE id = ${bookId}`;
            }
          }
        }

        if (bookId && workMatch) {
          const currentBookRows = await sql`SELECT cover, description, pages, "metadataSources" FROM "Book" WHERE id = ${bookId} LIMIT 1`;
          const curBook = currentBookRows[0];
          const newDescription = (workMatch.description && workMatch.description.trim().length > 0)
            ? ((!curBook?.description || workMatch.description.length > curBook.description.length) ? workMatch.description : curBook.description)
            : curBook?.description;
          const newCover = (workMatch.cover && workMatch.cover.trim().length > 0) ? workMatch.cover : curBook?.cover;

          const mergedMetadataSources = JSON.stringify({
            ...(curBook?.metadataSources ? (typeof curBook.metadataSources === 'string' ? JSON.parse(curBook.metadataSources) : curBook.metadataSources) : {}),
            ...(workMatch.metadataSources || {}),
          });

          await sql`
            UPDATE "Book"
            SET
              "googleId" = COALESCE(${workMatch.googleId ?? null}, "googleId"),
              cover = ${newCover ?? null},
              description = ${newDescription ?? null},
              year = COALESCE(${workMatch.year ?? null}, year),
              pages = COALESCE(${workMatch.pages ?? null}, pages),
              genre = COALESCE(${workMatch.genre ?? null}, genre),
              "isVerified" = true,
              "metadataSources" = ${mergedMetadataSources}::jsonb
            WHERE id = ${bookId}
          `;
          console.log(`[sync-quotes] Persisted metadata for book ${bookId}: title="${workMatch.title}", source="${workMatch.source}"`);
        }

        // Only create the quote if we found an Inventaire match
        // Create the quote with matched IDs
        const quoteRows = await sql`
          INSERT INTO "Quote" ("text", "date", "authorId", "bookId", "userId", "theme", "likesCount", "idempotencyKey")
          VALUES (${offlineQuote.text}, ${offlineQuote.createdAt}, ${authorId}, ${bookId}, ${authUser.id}, ${offlineQuote.theme || null}, 0, ${offlineQuote.idempotencyKey || null})
          RETURNING id
        `;

        // Add to user library
        if (quoteRows[0].id) {
          await sql`
            INSERT INTO "UserBook" ("userId", "bookId", status, "addedViaQuote", "addedAt")
            VALUES (${authUser.id}, ${bookId}, 'READING', true, now())
            ON CONFLICT ("userId", "bookId") DO NOTHING
          `;
        }

        // Trigger enrichment for author and book if they were created
        // Since we created them with Inventaire URI, enrichment can use it directly
        // Use waitUntil to not block the response
        if (authorLookup?.wasCreated && authorId) {
          console.log(`[sync-quotes] Triggering author enrichment for ${authorId}`);
          waitUntil(enrichAuthorWithInventaire(authorId, undefined, undefined, true));
        }

        if (bookId && inventaireMatch.workUri) {
          let shouldEnrich = bookLookup?.wasCreated;
          if (!shouldEnrich) {
            const bookRows = await sql`SELECT description, cover FROM "Book" WHERE id = ${bookId} LIMIT 1`;
            const bookData = bookRows[0];
            const isIncomplete = !bookData?.description || bookData.description.length < 30 || !bookData?.cover;
            if (isIncomplete) {
              shouldEnrich = true;
            }
          }
          if (shouldEnrich) {
            console.log(`[sync-quotes] Triggering book enrichment for ${bookId} (wasCreated=${!!bookLookup?.wasCreated})`);
            waitUntil(enrichBookWithInventaire(bookId));
          }
        } else if (bookLookup?.wasCreated && bookId && !inventaireMatch.workUri) {
          console.log(`[sync-quotes] Skipping Inventaire enrichment for book ${bookId}: no inventaireUri (source=${matchSource})`);
        }

        // Record sync result with corrections
        syncResults.push({
          quoteId: offlineQuote.id,
          realQuoteId: quoteRows[0].id,
          originalAuthor: offlineQuote.author,
          matchedAuthor: authorLookup?.wasCreated ? undefined : (authorLookup?.name || finalAuthorName),
          originalBook: offlineQuote.book,
          matchedBook: bookLookup?.wasCreated ? undefined : (bookLookup?.title || finalBookTitle),
          authorCreated: authorLookup?.wasCreated,
          bookCreated: bookLookup?.wasCreated,
          inventaireMatch: hasInventaireMatch || !!inventaireMatch.authorUri,
          inventaireUri: inventaireMatch.workUri || inventaireMatch.authorUri,
          matchSource,
          authorId: authorId,
          bookId: bookId,
        });

        syncedCount++;
      } catch (err: any) {
        console.error(`[sync-quotes] Error syncing quote:`, err);
        errors.push({ quote: offlineQuote, error: err.message });
      }
    }

    return json({
      success: true,
      syncedCount,
      errors,
      total: offlineQuotes.length,
      corrections: syncResults.filter(r => 
        (r.matchedAuthor && r.originalAuthor && r.originalAuthor !== r.matchedAuthor) ||
        (r.matchedBook && r.originalBook && r.originalBook !== r.matchedBook)
      ),
      created: syncResults.filter(r => r.authorCreated || r.bookCreated),
      syncDetails: syncResults.map(r => ({
        quoteId: r.quoteId,
        id: r.realQuoteId,
        authorId: r.authorId,
        bookId: r.bookId,
        authorCreated: r.authorCreated,
        bookCreated: r.bookCreated,
      })),
    });

  } catch (e: any) {
    console.error('[sync-quotes] Fatal error:', e);
    return error(e.message, 500);
  }
});
