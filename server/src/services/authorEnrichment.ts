import { PrismaClient } from '@prisma/client';
import { getAuthorWorks, searchAuthorQid, getAuthorNationality } from './wikidata';

const prisma = new PrismaClient();

export interface EnrichedAuthorData {
    description?: string;
    image?: string;
    birthDate?: string;
    nationality?: string;
}

/**
 * Fetches a concise summary (max 3 sentences) from Wikipedia
 */
const getWikipediaSummary = async (authorName: string): Promise<string | null> => {
    try {
        console.log(`[Enrichment] Fetching Wikipedia summary for ${authorName}`);
        const wpUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=3&explaintext=1&titles=${encodeURIComponent(authorName)}&format=json&origin=*`;
        const res = await fetch(wpUrl);
        if (!res.ok) return null;

        const data = await res.json();
        const pages = data.query?.pages;
        if (!pages) return null;

        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') return null; // Page not found

        return pages[pageId].extract || null;
    } catch (e) {
        console.error(`[Enrichment] Wikipedia error for ${authorName}:`, e);
        return null;
    }
};

export const enrichmentQueue: Map<number, Promise<EnrichedAuthorData | null>> = new Map();

export const enrichAuthor = async (authorId: number, authorName: string, olAuthorId?: string): Promise<EnrichedAuthorData | null> => {
    if (enrichmentQueue.has(authorId)) {
        console.log(`[Enrichment] Author ${authorName} (ID: ${authorId}) is already being enriched. Waiting for existing process...`);
        return enrichmentQueue.get(authorId)!;
    }

    const enrichmentPromise = (async () => {


        try {
            let finalOlId = olAuthorId;
            let bio = await getWikipediaSummary(authorName);
            if (bio) console.log(`[Enrichment] Found Wikipedia bio for ${authorName}`);

            if (!finalOlId) {
                console.log(`[Enrichment] No OL ID for ${authorName}, searching...`);
                const searchRes = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.docs && searchData.docs.length > 0) {
                        finalOlId = searchData.docs[0].key;
                        console.log(`[Enrichment] Found OpenLibrary ID: ${finalOlId}`);
                    }
                }
            }

            let birthDate: string | undefined;
            let image: string | undefined;
            let nationality: string | undefined;
            let olWorks: any[] = [];

            if (finalOlId) {
                const cleanOlId = finalOlId.replace('/authors/', '');
                const detailsRes = await fetch(`https://openlibrary.org/authors/${cleanOlId}.json`);
                if (detailsRes.ok) {
                    const details = await detailsRes.json();
                    if (!bio) {
                        if (typeof details.bio === 'string') bio = details.bio;
                        else if (details.bio?.value) bio = details.bio.value;
                        if (bio) console.log(`[Enrichment] Found OpenLibrary bio for ${authorName}`);
                        if (bio && bio.length > 500) bio = bio.substring(0, 500) + '...';
                    }
                    if (details.birth_date) console.log(`[Enrichment] Found birthDate: ${details.birth_date}`);
                    birthDate = details.birth_date || undefined;
                    image = `https://covers.openlibrary.org/a/olid/${cleanOlId}-L.jpg`;
                    console.log(`[Enrichment] Generated image URL: ${image}`);
                }

                // Fetch OL works for cover matching
                try {
                    const olWorksRes = await fetch(`https://openlibrary.org/authors/${cleanOlId}/works.json?limit=50`);
                    if (olWorksRes.ok) {
                        const olWorksData = await olWorksRes.json();
                        olWorks = olWorksData.entries || [];
                    }
                } catch (e) {
                    console.error(`[Enrichment] Failed to fetch OL works for ${authorName}`, e);
                }
            }

            try {
                const wikidataQid = await searchAuthorQid(authorName);
                if (wikidataQid) {
                    console.log(`[Enrichment] Fetching works and nationality for ${authorName} via Wikidata (${wikidataQid})`);
                    const [works, nat] = await Promise.all([
                        getAuthorWorks(wikidataQid),
                        getAuthorNationality(wikidataQid)
                    ]);
                    nationality = nat || undefined;
                    if (nationality) console.log(`[Enrichment] Found nationality for ${authorName}: ${nationality}`);
                    for (const work of works) {
                        const existing = await prisma.book.findUnique({ where: { title: work.title } });
                        if (!existing) {
                            const year = work.date ? parseInt(work.date.substring(0, 4)) : 0;

                            // Try to find a cover: 1. Wikidata's OLID, 2. Title match in OL list
                            let cover = work.openLibraryId ? `https://covers.openlibrary.org/b/olid/${work.openLibraryId}-M.jpg` : null;

                            if (!cover && olWorks.length > 0) {
                                const matchingOlWork = olWorks.find(olw =>
                                    olw.title.toLowerCase() === work.title.toLowerCase() ||
                                    work.title.toLowerCase().includes(olw.title.toLowerCase())
                                );
                                if (matchingOlWork && matchingOlWork.covers && matchingOlWork.covers.length > 0) {
                                    cover = `https://covers.openlibrary.org/b/id/${matchingOlWork.covers[0]}-M.jpg`;
                                }
                            }

                            console.log(`[Enrichment] Adding book: ${work.title}`);
                            await prisma.book.create({
                                data: {
                                    title: work.title,
                                    authorId: authorId,
                                    year: year,
                                    genre: work.genres || null, // Saving genres
                                    cover: cover,
                                    openLibraryId: work.openLibraryId || null,
                                }
                            }).catch(() => {
                                // Suppress P2002 (Unique constraint failed) to avoid noise
                            });
                        }
                    }
                } else if (finalOlId) {
                    const cleanOlId = finalOlId.replace('/authors/', '');
                    const worksRes = await fetch(`https://openlibrary.org/authors/${cleanOlId}/works.json?limit=20`);
                    if (worksRes.ok) {
                        const worksData = await worksRes.json();
                        for (const work of worksData.entries || []) {
                            const existing = await prisma.book.findUnique({ where: { title: work.title } });
                            if (!existing) {
                                const year = work.first_publish_date ? parseInt(work.first_publish_date.match(/\d{4}/)?.[0] || '0') : 0;
                                console.log(`[Enrichment] Adding book from OL: ${work.title}`);
                                await prisma.book.create({
                                    data: {
                                        title: work.title,
                                        authorId: authorId,
                                        year: year,
                                        cover: work.covers && work.covers.length > 0 ? `https://covers.openlibrary.org/b/id/${work.covers[0]}-M.jpg` : null,
                                        openLibraryId: work.key.replace('/works/', ''),
                                    }
                                }).catch(() => { });
                            }
                        }
                    }
                }
            } catch (workErr) {
                console.error(`[Enrichment] Error fetching works for ${authorName}:`, workErr);
            }

            console.log(`[Enrichment] Updating author ${authorName} with bio: ${!!bio}, image: ${!!image}, birthDate: ${birthDate}, nationality: ${nationality}`);
            await prisma.author.update({
                where: { id: authorId },
                data: {
                    description: bio || null,
                    image: image || null,
                    birthDate: birthDate || null,
                    nationality: nationality || null,
                }
            });

            return { description: bio || undefined, image, birthDate, nationality };
        } catch (e) {
            console.error(`[Enrichment] Error enriching author ${authorName}:`, e);
            return null;
        } finally {
            enrichmentQueue.delete(authorId);
        }
    })();

    enrichmentQueue.set(authorId, enrichmentPromise);
    return enrichmentPromise;
};
