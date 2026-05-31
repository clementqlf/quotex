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

        // Check Inventaire for author and work match
        const inventaireMatch: InventaireMatch = {};
        let hasInventaireMatch = false;
        
        console.log(`[sync-quotes] Checking Inventaire for: author="${offlineQuote.author}", book="${offlineQuote.book}"`);
        
        // Try to find the work in Inventaire
        const workUri = await findWorkUriByTitleAndAuthor(
          offlineQuote.book,
          offlineQuote.author
        );
        
        if (workUri) {
          inventaireMatch.workUri = workUri;
          hasInventaireMatch = true;
          console.log(`[sync-quotes] Inventaire work match found: ${workUri}`);
          
          // Get work details to get canonical title and author URIs
          const workDetails = await getInventaireWorkDetails(workUri);
          if (workDetails) {
            inventaireMatch.workTitle = workDetails.title;
            console.log(`[sync-quotes] Inventaire work canonical title: "${workDetails.title}"`);
            
            // Get author details for each author URI
            if (workDetails.authorUris && workDetails.authorUris.length > 0) {
              const authorDetails = await getInventaireAuthorDetails(workDetails.authorUris[0]);
              if (authorDetails) {
                inventaireMatch.authorUri = workDetails.authorUris[0];
                inventaireMatch.authorName = authorDetails.name;
                console.log(`[sync-quotes] Inventaire author canonical name: "${authorDetails.name}"`);
              }
            }
          }
        } else {
          // Also try searching for just the author
          const authorResults = await searchInventaireAuthors(offlineQuote.author, 5);
          if (authorResults.length > 0) {
            inventaireMatch.authorUri = authorResults[0].uri;
            inventaireMatch.authorName = authorResults[0].label;
            console.log(`[sync-quotes] Inventaire author match found: ${authorResults[0].label} (${authorResults[0].uri})`);
          }
        }
        
        // Only proceed if we have an Inventaire match
        if (!hasInventaireMatch && !inventaireMatch.authorUri) {
          console.log(`[sync-quotes] No Inventaire match found for quote ${offlineQuote.id} - skipping insertion`);
          errors.push({ 
            quote: offlineQuote, 
            error: 'No match in Inventaire - quote not inserted' 
          });
          continue;
        }

        // Use Inventaire canonical names and URIs for matching
        let authorId: number | null = null;
        let authorLookup: AuthorMatchResult | null = null;
        let bookId: number | null = null;
        let bookLookup: BookMatchResult | null = null;
        
        // Use canonical names from Inventaire if available
        const finalAuthorName = inventaireMatch.authorName || offlineQuote.author;
        const finalBookTitle = inventaireMatch.workTitle || offlineQuote.book;
        
        // Log corrections if using Inventaire names
        if (offlineQuote.author) {
          if (inventaireMatch.authorName && inventaireMatch.authorName !== offlineQuote.author) {
            console.log(`[sync-quotes] Using Inventaire author correction: "${offlineQuote.author}" -> "${finalAuthorName}"`);
          }
          if (inventaireMatch.workTitle && inventaireMatch.workTitle !== offlineQuote.book) {
            console.log(`[sync-quotes] Using Inventaire book correction: "${offlineQuote.book}" -> "${finalBookTitle}"`);
          }
        }

        // For author: try to find by Inventaire URI first, then by name
        if (offlineQuote.author) {
          if (inventaireMatch.authorUri) {
            // Check if author with this URI already exists
            const existingAuthor = await sql`
              SELECT id, name FROM "Author" WHERE "inventaireUri" = ${inventaireMatch.authorUri} LIMIT 1
            `;
            if (existingAuthor.length > 0) {
              authorId = existingAuthor[0].id;
              console.log(`[sync-quotes] Author found by Inventaire URI: ${finalAuthorName} (ID: ${authorId})`);
              authorLookup = {
                id: authorId,
                name: existingAuthor[0].name,
                wasCreated: false,
                originalName: finalAuthorName
              };
            } else {
              // Create new author with Inventaire URI
              const newAuthor = await sql`
                INSERT INTO "Author" (name, "inventaireUri", "isEnriching")
                VALUES (${finalAuthorName}, ${inventaireMatch.authorUri}, true)
                RETURNING id, name
              `;
              authorId = newAuthor[0].id;
              console.log(`[sync-quotes] Author created with Inventaire URI: ${finalAuthorName} (ID: ${authorId})`);
              authorLookup = {
                id: authorId,
                name: newAuthor[0].name,
                wasCreated: true,
                originalName: finalAuthorName
              };
            }
          } else {
            // Fallback to fuzzy matching without URI
            authorLookup = await matchAuthor(finalAuthorName);
            authorId = authorLookup?.id || null;
            console.log(`[sync-quotes] Author: ${authorLookup?.wasCreated ? 'CREATED' : 'MATCHED'} "${finalAuthorName}"`);
          }
        }

        // For book: try to find by Inventaire URI first, then by title+author
        if (offlineQuote.book) {
          if (inventaireMatch.workUri) {
            // Check if book with this URI already exists
            const existingBook = await sql`
              SELECT id, title FROM "Book" WHERE "inventaireUri" = ${inventaireMatch.workUri} LIMIT 1
            `;
            if (existingBook.length > 0) {
              bookId = existingBook[0].id;
              console.log(`[sync-quotes] Book found by Inventaire URI: ${finalBookTitle} (ID: ${bookId})`);
              bookLookup = {
                id: bookId,
                title: existingBook[0].title,
                wasCreated: false,
                originalTitle: finalBookTitle
              };
            } else {
              // Create new book with Inventaire URI
              const newBook = await sql`
                INSERT INTO "Book" (title, "authorId", "inventaireUri", "isEnriching")
                VALUES (${finalBookTitle}, ${authorId}, ${inventaireMatch.workUri}, true)
                RETURNING id, title
              `;
              bookId = newBook[0].id;
              console.log(`[sync-quotes] Book created with Inventaire URI: ${finalBookTitle} (ID: ${bookId})`);
              bookLookup = {
                id: bookId,
                title: newBook[0].title,
                wasCreated: true,
                originalTitle: finalBookTitle
              };
            }
          } else {
            // Fallback to fuzzy matching without URI
            bookLookup = await matchBook(finalBookTitle, authorId);
            bookId = bookLookup?.id || null;
            console.log(`[sync-quotes] Book: ${bookLookup?.wasCreated ? 'CREATED' : 'MATCHED'} "${finalBookTitle}"`);
          }
        }

        // Only create the quote if we found an Inventaire match
        // Create the quote with matched IDs
        const quoteRows = await sql`
          INSERT INTO "Quote" ("text", "date", "authorId", "bookId", "userId", "theme", "likesCount")
          VALUES (${offlineQuote.text}, ${offlineQuote.createdAt}, ${authorId}, ${bookId}, ${offlineQuote.userId}, ${offlineQuote.theme || null}, 0)
          RETURNING id
        `;

        // Add to user library
        if (quoteRows[0].id && offlineQuote.userId) {
          await sql`
            INSERT INTO "UserBook" ("userId", "bookId", status, "addedViaQuote", "addedAt")
            VALUES (${offlineQuote.userId}, ${bookId}, 'READING', true, now())
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
