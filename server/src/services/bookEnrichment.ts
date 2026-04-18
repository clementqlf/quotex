import { PrismaClient } from '@prisma/client';
import { searchGoogleBooks } from './googleBooks';
import { enrichWorkMetadata } from './inventaire';

const prisma = new PrismaClient();

/**
 * Fetches a concise summary (max 3 sentences) from Wikipedia
 */
export const getWikipediaSummary = async (bookTitle: string, authorName: string): Promise<string | null> => {
    try {
        console.log(`[BookEnrichment] Fetching Wikipedia summary for ${bookTitle} by ${authorName}`);

        // Try precise title, then title (livre), then title (roman)
        const queries = [
            bookTitle,
            `${bookTitle} (livre)`,
            `${bookTitle} (roman)`
        ];

        for (const query of queries) {
            const wpUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=5&explaintext=1&titles=${encodeURIComponent(query)}&format=json&origin=*`;
            const res = await fetch(wpUrl);
            if (!res.ok) continue;

            const data = await res.json();
            const pages = data.query?.pages;
            if (!pages) continue;

            const pageId = Object.keys(pages)[0];
            if (pageId === '-1') continue; // Page not found

            const extract = pages[pageId].extract;
            if (extract && extract.toLowerCase().includes(authorName.toLowerCase())) {
                return extract;
            }

            // If it's the first query and no author check, just take it if it seems long enough
            if (query !== bookTitle && extract && extract.length > 100) {
                return extract;
            }
        }
        return null;
    } catch (e) {
        console.error(`[BookEnrichment] Wikipedia error for ${bookTitle}:`, e);
        return null;
    }
};

export const bookEnrichmentQueue: Set<number> = new Set();

export const enrichBook = async (bookId: number, bookTitle: string, authorName: string): Promise<any | null> => {
    if (bookEnrichmentQueue.has(bookId)) return null;
    bookEnrichmentQueue.add(bookId);

    try {
        console.log(`[BookEnrichment] Starting enrichment for: ${bookTitle} by ${authorName}`);

        // 1. Fetch data from Google Books
        const results = await searchGoogleBooks(`${bookTitle} ${authorName}`);
        let bestMatch = results.find(b =>
            b.title.toLowerCase().includes(bookTitle.toLowerCase()) ||
            bookTitle.toLowerCase().includes(b.title.toLowerCase())
        );

        if (!bestMatch && results.length > 0) {
            bestMatch = results[0];
        }

        // 2. Try Wikipedia only if description is missing or too short from Google
        let description = bestMatch?.description || null;
        if (!description || description.length < 100) {
            const wpSummary = await getWikipediaSummary(bookTitle, authorName);
            if (wpSummary) {
                description = wpSummary;
            }
        }

        if (bestMatch || description) {
            console.log(`[BookEnrichment] Found data for ${bookTitle}. Updating DB.`);

            const updateData: any = {};
            if (description) {
                console.log(`[BookEnrichment] Updating description for ${bookTitle}`);
                updateData.description = description;
            }
            if (bestMatch) {
                if (bestMatch.year) {
                    console.log(`[BookEnrichment] Updating year to ${bestMatch.year}`);
                    updateData.year = bestMatch.year;
                }
                if (bestMatch.pages) {
                    console.log(`[BookEnrichment] Updating pages to ${bestMatch.pages}`);
                    updateData.pages = bestMatch.pages;
                }
                if (bestMatch.cover) {
                    console.log(`[BookEnrichment] Updating cover`);
                    updateData.cover = bestMatch.cover;
                }
                if (bestMatch.genre) {
                    console.log(`[BookEnrichment] Updating genre to ${bestMatch.genre}`);
                    updateData.genre = bestMatch.genre;
                }
                if (bestMatch.rating) {
                    console.log(`[BookEnrichment] Updating rating to ${bestMatch.rating}`);
                    updateData.rating = bestMatch.rating;
                }
                if (bestMatch.isbn) {
                    console.log(`[BookEnrichment] Updating ISBN to ${bestMatch.isbn}`);
                    updateData.isbn = bestMatch.isbn;
                }
                if (bestMatch.googleId) {
                    console.log(`[BookEnrichment] Updating Google ID`);
                    updateData.googleId = bestMatch.googleId;
                }

                if (bestMatch.buyLink) {
                    console.log(`[BookEnrichment] Updating buy links`);
                    updateData.buyLinks = JSON.stringify([{
                        store: 'Google Books',
                        url: bestMatch.buyLink,
                        price: bestMatch.price || 'Voir sur le site'
                    }]);
                }
            }

            const updatedBook = await prisma.book.update({
                where: { id: bookId },
                data: updateData
            });

            return updatedBook;
        }

        console.log(`[BookEnrichment] No data found for ${bookTitle}`);
        return null;
    } catch (e) {
        console.error(`[BookEnrichment] Error enriching book ${bookTitle}:`, e);
        return null;
    } finally {
        bookEnrichmentQueue.delete(bookId);
    }
};

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
            if (enriched.description && (!book.description || book.description.length < 50)) {
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
