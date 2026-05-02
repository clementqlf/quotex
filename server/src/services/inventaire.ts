import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import * as api from './inventaire.api';

// Re-export everything from the API so dependents don't break
export * from './inventaire.api';

// ─── Deduplication / Concurrency ─────────────────────────────────────────────
// Instead of a Set that ignores concurrent requests, we use a Map of Promises.
// This ensures that concurrent calls wait for the same result.
export const activeAuthorEnrichments = new Map<number, Promise<any>>();

// ─── DB Services ─────────────────────────────────────────────────────────────

/**
 * Merges a source book into a target book, moving all quotes and reviews,
 * then deleting the source book.
 */
export async function mergeBooks(sourceId: number, targetId: number, tx?: Prisma.TransactionClient) {
    if (sourceId === targetId) return;
    console.log(`[Inventaire Service] Merging book ${sourceId} into ${targetId}...`);
    
    const operation = async (client: any) => {
        // Move quotes
        await client.quote.updateMany({
            where: { bookId: sourceId },
            data: { bookId: targetId }
        });
        // Move reviews
        await client.review.updateMany({
            where: { bookId: sourceId },
            data: { bookId: targetId }
        });
        // Delete source book
        await client.book.delete({ where: { id: sourceId } });
    };

    try {
        if (tx) {
            await operation(tx);
        } else {
            await prisma.$transaction(async (newTx) => await operation(newTx));
        }
        console.log(`[Inventaire Service] Merge successful. Source book ${sourceId} deleted.`);
    } catch (e) {
        console.error(`[Inventaire Service] Merge failed between books ${sourceId} and ${targetId}:`, e);
        throw e;
    }
}

/**
 * Merges a source author into a target author, moving all books, quotes and followers,
 * then deleting the source author.
 */
export async function mergeAuthors(sourceId: number, targetId: number) {
    if (sourceId === targetId) return;
    console.log(`[Inventaire Service] Merging author ${sourceId} into ${targetId}...`);
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Move books one by one to handle title conflicts
            const sourceBooks = await tx.book.findMany({ where: { authorId: sourceId } });
            for (const book of sourceBooks) {
                const conflict = await tx.book.findFirst({
                    where: {
                        authorId: targetId,
                        OR: [
                            { title: book.title },
                            ...(book.inventaireUri ? [{ inventaireUri: book.inventaireUri }] : [])
                        ]
                    }
                });
                
                if (conflict) {
                    await mergeBooks(book.id, conflict.id, tx as any);
                } else {
                    await tx.book.update({
                        where: { id: book.id },
                        data: { authorId: targetId }
                    });
                }
            }

            // 2. Move quotes
            await tx.quote.updateMany({
                where: { authorId: sourceId },
                data: { authorId: targetId }
            });

            // 3. Move followers (UserAuthor)
            const sourceFollowers = await tx.userAuthor.findMany({
                where: { authorId: sourceId }
            });
            
            for (const follow of sourceFollowers) {
                const alreadyFollowing = await tx.userAuthor.findUnique({
                    where: { 
                        userId_authorId: { 
                            userId: follow.userId, 
                            authorId: targetId 
                        } 
                    }
                });
                
                if (!alreadyFollowing) {
                    await tx.userAuthor.create({
                        data: { 
                            userId: follow.userId, 
                            authorId: targetId, 
                            addedAt: follow.addedAt 
                        }
                    });
                }
            }
            
            // 4. Delete source author
            await tx.author.delete({ where: { id: sourceId } });
        });
        console.log(`[Inventaire Service] Merge successful. Source author ${sourceId} deleted.`);
    } catch (e) {
        console.error(`[Inventaire Service] Merge failed between authors ${sourceId} and ${targetId}:`, e);
        throw e;
    }
}

export const enrichWorkMetadata = async (uri: string): Promise<any> => {
    console.log(`[Inventaire Service] Starting full enrichment for ${uri}`);
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
        authors: []
    };

    if (details.authorUris.length > 0) {
        const authorEntities = await api.getInventaireEntities([details.authorUris[0]]);
        const authorEntry = authorEntities[details.authorUris[0]];
        if (authorEntry && authorEntry.labels) {
            result.authors = [authorEntry.labels['fr'] || authorEntry.labels['en'] || Object.values(authorEntry.labels)[0]];
        }
    }

    if (details.wikipediaTitle) {
        const synopsis = await api.fetchWikipediaSynopsis(details.wikipediaTitle, 'fr');
        if (synopsis) {
            result.description = synopsis;
            console.log(`[Inventaire Service] Found Wikipedia (FR) synopsis: ${synopsis}`);
        }
    }

    try {
        const searchMetadata = await api.getBatchInventaireSearchMetadata([uri]);
        if (api.isNativeScan(searchMetadata[uri]?.image)) {
            result.image = searchMetadata[uri].image;
        }

        const editions = await api.getWorkEditions(nativeUri);
        result.editions = editions;

        if (editions.length > 0) {
            const scoredEds = editions.map(e => {
                let score = 0;
                if (e.languageUri === 'wd:Q150') score += 10;
                if (e.cover?.includes('/img/entities/')) score += 5;
                if (e.isbn) score += 2;
                if (e.pages && e.pages > 0) score += 1;
                return { ed: e, score };
            }).sort((a, b) => b.score - a.score);

            const bestEd = scoredEds[0].ed;
            if (bestEd.cover) {
                result.image = bestEd.cover;
            }

            const editionWithPages = editions.find(e => e.pages && e.pages > 0);
            if (editionWithPages) {
                result.pages = editionWithPages.pages;
            }

            if (!result.year) {
                const editionWithYear = editions.find(e => e.publishDate);
                if (editionWithYear && editionWithYear.publishDate) {
                    result.year = parseInt(editionWithYear.publishDate.substring(0, 4));
                }
            }
        }
    } catch (err) {
        console.error(`[Inventaire Service] Failed to fetch editions for pages/covers`, err);
    }

    return result;
};

export const syncAuthorProfile = async (authorId: number, authorName?: string, authorUri?: string): Promise<any> => {
    // 1. Deduplication using Promises
    if (activeAuthorEnrichments.has(authorId)) {
        console.log(`[Inventaire Service] Joining existing enrichment for author ID: ${authorId}`);
        return activeAuthorEnrichments.get(authorId);
    }

    const enrichmentPromise = (async () => {
        try {
            await prisma.author.update({ where: { id: authorId }, data: { isEnriching: true } }).catch(e => console.error(`Failed to set isEnriching for ${authorId}`, e));

            const author = await prisma.author.findUnique({ where: { id: authorId } }) as any;
            if (!author) return null;

            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
            const now = new Date().getTime();
            const lastEnriched = author.lastEnrichedAt ? new Date(author.lastEnrichedAt).getTime() : 0;
            const isProfileFresh = (now - lastEnriched) < SEVEN_DAYS;

            if (isProfileFresh) {
                console.log(`[Inventaire Service] Author ${author.name} is already freshly enriched. Skipping.`);
                return author;
            }

            const nameToSearch = authorName || author.name;
            let uri = authorUri || author.inventaireUri;

            if (!uri) {
                const searchResults = await api.searchInventaireAuthors(nameToSearch, 5);
                if (searchResults.length > 0) {
                    const match = searchResults.find(r => r.label.toLowerCase() === nameToSearch.toLowerCase()) || searchResults[0];
                    uri = match.uri;
                }
            }

            if (!uri) return null;

            // 2. Check for conflict: Does another author record already use this URI?
            const existingWithUri = await prisma.author.findUnique({ where: { inventaireUri: uri } });
            if (existingWithUri && existingWithUri.id !== authorId) {
                console.log(`[Inventaire Service] ⚠️ Conflict detected: Author ${existingWithUri.id} already has URI ${uri}. Merging...`);
                await mergeAuthors(authorId, existingWithUri.id);
                // Recursively call sync for the survivor and return its result
                return await syncAuthorProfile(existingWithUri.id, authorName, uri);
            }

            const details = await api.getInventaireAuthorDetails(uri);
            if (!details) return null;

            const isNewEntity = uri !== author.inventaireUri;
            let biography = isNewEntity ? null : author.description;

            if (details.wikipediaTitle && (isNewEntity || !biography || biography.length < 50)) {
                const synopsis = await api.fetchWikipediaSynopsis(details.wikipediaTitle, 'fr');
                if (synopsis) {
                    biography = synopsis;
                }
            }

            const updateData: any = { inventaireUri: uri };

            if (details.name && author.name !== details.name) {
                const conflict = await prisma.author.findUnique({ where: { name: details.name } });
                if (!conflict) updateData.name = details.name;
            }

            updateData.description = isNewEntity ? biography : (biography || author.description);
            updateData.image = isNewEntity ? details.image : (details.image || author.image);
            updateData.birthDate = isNewEntity ? details.birthDate : (details.birthDate || author.birthDate);
            updateData.nationality = isNewEntity ? details.nationality : (details.nationality || author.nationality);

            if (updateData.nationality && (updateData.nationality.startsWith('wd:') || updateData.nationality.startsWith('inv:'))) {
                try {
                    const natEntities = await api.getInventaireEntities([updateData.nationality]);
                    const natEntity = natEntities[updateData.nationality];
                    if (natEntity && natEntity.labels) {
                        updateData.nationality = natEntity.labels['fr'] || natEntity.labels['en'] || Object.values(natEntity.labels)[0];
                    }
                } catch (err) {
                    console.error(`[Inventaire Service] Failed to resolve nationality label`, err);
                }
            }

            updateData.lastEnrichedAt = new Date();
            
            let updatedAuthor;
            try {
                updatedAuthor = await prisma.author.update({
                    where: { id: authorId },
                    data: updateData as any
                });
            } catch (err: any) {
                if (err.code === 'P2002' && err.meta?.target?.includes('inventaireUri')) {
                    console.log(`[Inventaire Service] Race condition: Author with URI ${uri} was created/updated concurrently. Merging...`);
                    const survivor = await prisma.author.findUnique({ where: { inventaireUri: uri } });
                    if (survivor) {
                        await mergeAuthors(authorId, survivor.id);
                        return await syncAuthorProfile(survivor.id, authorName, uri);
                    }
                }
                throw err;
            }

            console.log(`[Inventaire Service] Enrichment complete for ${updatedAuthor.name}`);
            return updatedAuthor;
        } catch (e) {
            console.error(`[Inventaire Service] Author enrichment error:`, e);
            return null;
        } finally {
            // We might have deleted the author during merge, so check if it still exists before clearing flag
            const exists = await prisma.author.findUnique({ where: { id: authorId }, select: { id: true } });
            if (exists) {
                await prisma.author.update({ where: { id: authorId }, data: { isEnriching: false } }).catch(e => console.error(`Failed to clear isEnriching for ${authorId}`, e));
            }
            activeAuthorEnrichments.delete(authorId);
        }
    })();

    activeAuthorEnrichments.set(authorId, enrichmentPromise);
    return enrichmentPromise;
};

export const discoverAuthorWorks = async (authorId: number, authorUri?: string): Promise<void> => {
    try {
        const author = await prisma.author.findUnique({ where: { id: authorId } }) as any;
        if (!author) return;

        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        const lastDiscovered = author.lastDiscoveredAt ? new Date(author.lastDiscoveredAt).getTime() : 0;
        const isDiscoveryFresh = (now - lastDiscovered) < SEVEN_DAYS;

        if (isDiscoveryFresh) {
            console.log(`[Inventaire Service] Author ${author.name} works already discovered recently. Skipping.`);
            return;
        }

        const uri = authorUri || author.inventaireUri;
        if (!uri) return;

        console.log(`[Inventaire Service] Discovering all works for author: ${author.name} (${uri})`);
        const workUris = await api.getAuthorWorkUris(uri);

        if (workUris.length > 0) {
            const limitedUris = workUris.slice(0, 100);
            const CHUNK_SIZE = 25;
            for (let i = 0; i < limitedUris.length; i += CHUNK_SIZE) {
                const chunk = limitedUris.slice(i, i + CHUNK_SIZE);
                const [workEntities, bestCovers] = await Promise.all([
                    api.getBatchInventaireDetails(chunk),
                    api.getBestNativeCovers(chunk)
                ]);

                for (const [wUri, details] of Object.entries(workEntities)) {
                    if (!details || !details.title) continue;

                    const bestCover = bestCovers[wUri];
                    const finalCover = bestCover || details.image || null;
                    const bookTitle = details.title.trim();

                    const existingBook = await prisma.book.findFirst({
                        where: {
                            OR: [
                                { inventaireUri: wUri },
                                { AND: [{ title: bookTitle }, { authorId: author.id }] }
                            ]
                        }
                    });

                    if (!existingBook) {
                        try {
                            await prisma.book.create({
                                data: {
                                    title: bookTitle,
                                    authorId: author.id,
                                    inventaireUri: wUri,
                                    cover: finalCover,
                                    year: details.year || 0,
                                    description: '',
                                    genre: ''
                                }
                            });
                        } catch (err: any) {
                            if (err.code === 'P2002') {
                                console.log(`[Inventaire Service] Book "${bookTitle}" already exists (race condition), skipping.`);
                            }
                        }
                    } else if (!existingBook.inventaireUri) {
                        await prisma.book.update({
                            where: { id: existingBook.id },
                            data: { inventaireUri: wUri }
                        }).catch(e => console.error(`Failed to update book ${existingBook.id}`, e));
                    }
                }
            }
        }

        await prisma.author.update({
            where: { id: authorId },
            data: { lastDiscoveredAt: new Date() } as any
        }).catch(e => console.error(`Failed to update lastDiscoveredAt for ${authorId}`, e));

    } catch (e) {
        console.error(`[Inventaire Service] Author discovery error:`, e);
    }
};

export const enrichAuthorWithInventaire = async (authorId: number, authorName?: string, authorUri?: string, skipDiscovery: boolean = false): Promise<any> => {
    const author = await syncAuthorProfile(authorId, authorName, authorUri);
    if (!author) return null;

    if (!skipDiscovery && author.inventaireUri) {
        await discoverAuthorWorks(authorId, author.inventaireUri);
    }
    return author;
};
