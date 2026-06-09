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
import { findWorkUriByTitleAndAuthor, searchInventaireAuthors, getInventaireWorkDetails, getInventaireAuthorDetails, enrichAuthorWithInventaire } from '../_shared/inventaire.ts';
import { enrichBookWithInventaire } from '../_shared/bookEnrichment.ts';

interface OfflineQuote {
  id: string;
  text: string;
  author?: string;
  book?: string;
  theme?: string;
  createdAt: string;
  userId: string;
}

interface SyncResult {
  quoteId: string;
  originalAuthor?: string;
  matchedAuthor?: string;
  originalBook?: string;
  matchedBook?: string;
  authorCreated?: boolean;
  bookCreated?: boolean;
  inventaireMatch?: boolean;
  inventaireUri?: string;
}

interface InventaireMatch {
  authorUri?: string;
  authorName?: string;
  workUri?: string;
  workTitle?: string;
}

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

        if ((offlineQuote.author && !authorId) || (offlineQuote.book && !bookId)) {
          console.log(`[sync-quotes] Entity missing in DB. Checking Inventaire for: author="${offlineQuote.author}", book="${offlineQuote.book}"`);
          
          if (offlineQuote.book && offlineQuote.author) {
            const workUri = await findWorkUriByTitleAndAuthor(offlineQuote.book, offlineQuote.author);
            if (workUri) {
              inventaireMatch.workUri = workUri;
              hasInventaireMatch = true;
              console.log(`[sync-quotes] Inventaire work match found: ${workUri}`);
              
              const workDetails = await getInventaireWorkDetails(workUri);
              if (workDetails) {
                inventaireMatch.workTitle = workDetails.title;
                if (workDetails.authorUris && workDetails.authorUris.length > 0) {
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
          console.log(`[sync-quotes] Using Inventaire author correction: "${offlineQuote.author}" -> "${finalAuthorName}"`);
        }
        if (offlineQuote.book && inventaireMatch.workTitle && inventaireMatch.workTitle !== offlineQuote.book) {
          console.log(`[sync-quotes] Using Inventaire book correction: "${offlineQuote.book}" -> "${finalBookTitle}"`);
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
              await sql`UPDATE "Author" SET "inventaireUri" = ${inventaireMatch.authorUri}, "isEnriching" = true WHERE id = ${authorId}`;
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
              await sql`UPDATE "Book" SET "inventaireUri" = ${inventaireMatch.workUri}, "isEnriching" = true WHERE id = ${bookId}`;
            }
          }
        }

        // Only create the quote if we found an Inventaire match
        // Create the quote with matched IDs
        const quoteRows = await sql`
          INSERT INTO "Quote" ("text", "date", "authorId", "bookId", "userId", "theme", "likesCount")
          VALUES (${offlineQuote.text}, ${offlineQuote.createdAt}, ${authorId}, ${bookId}, ${authUser.id}, ${offlineQuote.theme || null}, 0)
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
          if (typeof EdgeRuntime !== 'undefined') {
            EdgeRuntime.waitUntil(
              enrichAuthorWithInventaire(authorId, undefined, undefined, true)
            );
          } else {
            // Fallback for non-EdgeRuntime environments
            enrichAuthorWithInventaire(authorId, undefined, undefined, true).catch(console.error);
          }
        }

        if (bookLookup?.wasCreated && bookId) {
          console.log(`[sync-quotes] Triggering book enrichment for ${bookId}`);
          if (typeof EdgeRuntime !== 'undefined') {
            EdgeRuntime.waitUntil(
              enrichBookWithInventaire(bookId)
            );
          } else {
            // Fallback for non-EdgeRuntime environments
            enrichBookWithInventaire(bookId).catch(console.error);
          }
        }

        // Record sync result with corrections
        syncResults.push({
          quoteId: offlineQuote.id,
          originalAuthor: offlineQuote.author,
          matchedAuthor: authorLookup?.wasCreated ? undefined : (authorLookup?.name || finalAuthorName),
          originalBook: offlineQuote.book,
          matchedBook: bookLookup?.wasCreated ? undefined : (bookLookup?.title || finalBookTitle),
          authorCreated: authorLookup?.wasCreated,
          bookCreated: bookLookup?.wasCreated,
          inventaireMatch: hasInventaireMatch || !!inventaireMatch.authorUri,
          inventaireUri: inventaireMatch.workUri || inventaireMatch.authorUri,
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
