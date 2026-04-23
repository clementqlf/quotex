import { prisma } from '../lib/prisma';
import { searchGoogleBooks } from './googleBooks';
import { enrichWorkMetadata, enrichAuthorWithInventaire, findWorkUriByTitleAndAuthor } from './inventaire';

export const bookEnrichmentQueue: Set<number> = new Set();

/**
 * Merges a source book into a target book, moving all quotes and reviews,
 * then deleting the source book.
 */
async function mergeBooks(sourceId: number, targetId: number) {
    console.log(`[BookEnrichment] Merging book ${sourceId} into ${targetId}...`);
    try {
        await prisma.$transaction([
            // Move quotes
            prisma.quote.updateMany({
                where: { bookId: sourceId },
                data: { bookId: targetId }
            }),
            // Move reviews
            prisma.review.updateMany({
                where: { bookId: sourceId },
                data: { bookId: targetId }
            }),
            // Move editions (individual updates because of uniqueness)
            // Note: We don't merge editions strictly yet as they might conflict on URI.
            // Deleting the source book will handle his editions via cascade or they remain orphans.
            
            // Delete source book
            prisma.book.delete({ where: { id: sourceId } })
        ]);
        console.log(`[BookEnrichment] Merge successful. Source book ${sourceId} deleted.`);
    } catch (e) {
        console.error(`[BookEnrichment] Merge failed between ${sourceId} and ${targetId}:`, e);
        throw e;
    }
}

/**
 * Specifically enriches a book using Inventaire.io data
 */
export const enrichBookWithInventaire = async (bookId: number): Promise<any | null> => {
    if (bookEnrichmentQueue.has(bookId)) return null;
    bookEnrichmentQueue.add(bookId);

    try {
        await prisma.book.update({ where: { id: bookId }, data: { isEnriching: true } as any }).catch(() => {});
        const book = await prisma.book.findUnique({ where: { id: bookId } });
        if (!book || !(book as any).inventaireUri) return null;

        console.log(`[BookEnrichment] Starting Inventaire enrichment for: ${(book as any).title} (${(book as any).inventaireUri})`);
        const enriched = await enrichWorkMetadata((book as any).inventaireUri);
        
        if (enriched) {
            const updateData: any = {};

            // 1. Standardize Title with Merge logic
            if (enriched.title && book.title !== enriched.title) {
                const targetBook = await prisma.book.findFirst({
                    where: {
                        title: enriched.title,
                        authorId: (book as any).authorId,
                        NOT: { id: bookId }
                    }
                });

                if (targetBook) {
                    await mergeBooks(bookId, targetBook.id);
                    
                    // If target book didn't have a URI, give it the one we found
                    if (!(targetBook as any).inventaireUri) {
                        await prisma.book.update({
                            where: { id: targetBook.id },
                            data: { inventaireUri: (book as any).inventaireUri } as any
                        }).catch(() => {});
                    }
                    return true;
                } else {
                    updateData.title = enriched.title;
                }
            }

            // 2. Metadata updates (only if book wasn't deleted by merge)
            if (enriched.description) {
                updateData.description = enriched.description;
            }
            if (enriched.pages && (!book.pages || book.pages === 0)) {
                updateData.pages = enriched.pages;
            }
            if (enriched.year && (!book.year || book.year === 0)) {
                updateData.year = enriched.year;
            }
            if (enriched.image) {
                const currentIsWiki = (!book.cover || book.cover.includes('wikimedia.org'));
                const newIsInternal = enriched.image.includes('/img/entities/');
                if (!book.cover || (currentIsWiki && newIsInternal)) {
                    updateData.cover = enriched.image;
                }
            }

            if (Object.keys(updateData).length > 0) {
                console.log(`[BookEnrichment] Applying updates to ${(book as any).title}:`, Object.keys(updateData));
                await prisma.book.update({
                    where: { id: bookId },
                    data: updateData
                });
            }

            // --- UPSERT Editions ---
            if (enriched.editions && Array.isArray(enriched.editions)) {
                console.log(`[BookEnrichment] Syncing ${enriched.editions.length} editions for ${(book as any).title}`);
                for (const ed of enriched.editions) {
                    await (prisma as any).edition.upsert({
                        where: { inventaireUri: ed.inventaireUri },
                        update: {
                            isbn: ed.isbn,
                            title: ed.title,
                            publishDate: ed.publishDate,
                            publisherUri: ed.publisherUri,
                            languageUri: ed.languageUri,
                            cover: ed.cover,
                            bookId: bookId
                        },
                        create: {
                            inventaireUri: ed.inventaireUri,
                            isbn: ed.isbn,
                            title: ed.title,
                            publishDate: ed.publishDate,
                            publisherUri: ed.publisherUri,
                            languageUri: ed.languageUri,
                            cover: ed.cover,
                            bookId: bookId
                        }
                    }).catch((err: any) => console.error(`[BookEnrichment] Failed to upsert edition ${ed.inventaireUri}`, err));
                }
            }
            
            // --- Trigger Author Enrichment with URIs ---
            if (enriched.authorUris && Array.isArray(enriched.authorUris) && (book as any).authorId) {
                for (const authorUri of enriched.authorUris) {
                    console.log(`[BookEnrichment] Triggering direct author enrichment for URI: ${authorUri}`);
                    enrichAuthorWithInventaire((book as any).authorId, undefined, authorUri).catch(e => 
                        console.error(`[BookEnrichment] Author enrichment failed:`, e)
                    );
                }
            }
            
            return true;
        }
        return null;
    } catch (e) {
        console.error(`[BookEnrichment] Inventaire enrichment error for book ${bookId}:`, e);
        return null;
    } finally {
        await prisma.book.update({ where: { id: bookId }, data: { isEnriching: false } as any }).catch(() => {});
        bookEnrichmentQueue.delete(bookId);
    }
};

/**
 * Intermediate function that discovers the Inventaire URI for a book 
 */
export const discoverAndEnrichBook = async (bookId: number): Promise<void> => {
    console.log(`[BookEnrichment/Discovery] Starting discovery for Book ID: ${bookId}`);
    try {
        await prisma.book.update({ where: { id: bookId }, data: { isEnriching: true } as any }).catch(() => {});
        const book = await prisma.book.findUnique({
            where: { id: bookId },
            include: { author: true }
        });

        if (!book) {
            console.log(`[BookEnrichment/Discovery] ❌ Book with ID ${bookId} not found in database.`);
            return;
        }

        if ((book as any).inventaireUri) {
            console.log(`[BookEnrichment/Discovery] Book already has URI: ${(book as any).inventaireUri}. Skipping discovery, going to enrichment.`);
            await enrichBookWithInventaire(bookId);
            return;
        }

        const authorName = book.author?.name || 'Unknown';
        console.log(`[BookEnrichment/Discovery] Attempting to resolve URI for "${book.title}" by "${authorName}"`);
        
        const uri = await findWorkUriByTitleAndAuthor(book.title, authorName);
        
        if (uri) {
            console.log(`[BookEnrichment/Discovery] ✅ URI resolved: ${uri}. Checking for conflicts...`);
            const existingBook = await prisma.book.findUnique({
                where: { inventaireUri: uri }
            });

            if (existingBook && existingBook.id !== bookId) {
                console.log(`[BookEnrichment/Discovery] ⚠️ Conflict detected: Book ${existingBook.id} already has URI ${uri}. Merging...`);
                await mergeBooks(bookId, existingBook.id);
                // Enrichment for the survivor
                await enrichBookWithInventaire(existingBook.id);
                return;
            }

            await prisma.book.update({
                where: { id: bookId },
                data: { inventaireUri: uri } as any
            });
            console.log(`[BookEnrichment/Discovery] Database updated. Launching full enrichment...`);
            await enrichBookWithInventaire(bookId);
        } else {
            console.log(`[BookEnrichment/Discovery] ❌ Could not resolve URI for "${book.title}". Enrichment aborted.`);
        }
    } catch (e) {
        console.error(`[BookEnrichment/Discovery] ❌ Error during discovery for book ${bookId}:`, e);
    }
};

