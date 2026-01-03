import { searchOpenLibraryWorks, OpenLibraryWork } from './openLibrary';
import { searchGoogleBooks, FormattedBook } from './googleBooks';

// Helper to normalize strings for aggressive deduplication (Pass 1)
const strongNormalize = (str: string) => {
    return str
        .toLowerCase()
        .split(/[:\(\-]/)[0] // Strip subtitles, parentheticals, or long suffixes
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9]/g, "") // Remove everything except alphanumeric
        .trim();
};

export const searchHybrid = async (query: string): Promise<FormattedBook[]> => {
    // 1. Search Open Library for structure (Works)
    // Fetch a larger pool of results to ensure we don't miss unique works during deduplication
    const olResults = await searchOpenLibraryWorks(query);

    // 2. Pass 1: Deduplicate OL results by aggressively normalized Title + Author
    const seenOLKeys = new Set<string>();
    const uniqueOLWorks: OpenLibraryWork[] = [];

    for (const work of olResults) {
        const titleKey = strongNormalize(work.title);
        const authorKey = strongNormalize(work.author_name?.[0] || 'unknown');
        const key = `${titleKey}|${authorKey}`;

        if (!seenOLKeys.has(key)) {
            seenOLKeys.add(key);
            uniqueOLWorks.push(work);
        }
        // Take a decent bite for the next step, but not too many to avoid API rate limits
        if (uniqueOLWorks.length >= 8) break;
    }

    // 3. Enhance results with Google Books data
    const enrichedResults = await Promise.all(uniqueOLWorks.map(async (olWork) => {
        let bestMatch: FormattedBook | null = null;

        // Try precise ISBN match
        if (olWork.isbn && olWork.isbn.length > 0) {
            for (const isbn of olWork.isbn.slice(0, 3)) {
                const gbResults = await searchGoogleBooks(`isbn:${isbn}`);
                if (gbResults.length > 0) {
                    bestMatch = gbResults[0];
                    break;
                }
            }
        }

        // Fallback to Title + Author
        if (!bestMatch) {
            const author = olWork.author_name ? olWork.author_name[0] : '';
            const searchQ = `${olWork.title} ${author}`;
            const gbResults = await searchGoogleBooks(searchQ);
            if (gbResults.length > 0) {
                bestMatch = gbResults[0];
            }
        }

        const olCover = olWork.cover_i
            ? `https://covers.openlibrary.org/b/id/${olWork.cover_i}-L.jpg`
            : null;

        return {
            googleId: bestMatch?.googleId || `ol-${olWork.key.replace('/works/', '')}`,
            openLibraryId: olWork.key,
            authorOpenLibraryId: olWork.author_key ? olWork.author_key[0] : undefined,
            title: olWork.title,
            authors: olWork.author_name || (bestMatch?.authors || ['Unknown']),
            description: bestMatch?.description || '',
            year: olWork.first_publish_year || bestMatch?.year || null,
            pages: bestMatch?.pages || null,
            cover: olCover || bestMatch?.cover || null,
            genre: bestMatch?.genre || null,
            isbn: bestMatch?.isbn || (olWork.isbn ? olWork.isbn[0] : null),
            rating: bestMatch?.rating || null,
            buyLink: bestMatch?.buyLink || null,
            price: bestMatch?.price || null
        };
    }));

    // 4. Pass 2: Deduplicate results based on Google ID or ISBN
    const finalResults: FormattedBook[] = [];
    const seenIds = new Set<string>();

    for (const book of enrichedResults) {
        // If we have a Google ID, use it as primary deduplicator. Otherwise use ISBN.
        const idKey = book.googleId || (book.isbn ? `isbn-${book.isbn}` : book.openLibraryId);

        if (!seenIds.has(idKey)) {
            seenIds.add(idKey);
            finalResults.push(book);
        }
        // Limit to top 5 final results
        if (finalResults.length >= 5) break;
    }

    return finalResults;
};
