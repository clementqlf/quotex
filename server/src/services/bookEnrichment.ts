import { prisma } from '../lib/prisma';
import { searchGoogleBooks } from './googleBooks';
import { enrichWorkMetadata, enrichAuthorWithInventaire } from './inventaire';

export const bookEnrichmentQueue: Set<number> = new Set();

/**
 * Specifically enriches a book using Inventaire.io data
 */
export const enrichBookWithInventaire = async (bookId: number): Promise<any | null> => {
    if (bookEnrichmentQueue.has(bookId)) return null;
    bookEnrichmentQueue.add(bookId);

    try {
        const book = await prisma.book.findUnique({ where: { id: bookId } });
        if (!book || !(book as any).inventaireUri) return null;

        console.log(`[BookEnrichment] Starting Inventaire enrichment for: ${(book as any).title} (${(book as any).inventaireUri})`);
        const enriched = await enrichWorkMetadata((book as any).inventaireUri);

        if (enriched) {
            const updateData: any = {};
            
            // Only update if current data is missing or obviously shorter (like a placeholder)
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
        bookEnrichmentQueue.delete(bookId);
    }
};
