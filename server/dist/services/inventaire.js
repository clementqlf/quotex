"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichAuthorWithInventaire = exports.discoverAuthorWorks = exports.syncAuthorProfile = exports.enrichWorkMetadata = exports.activeAuthorEnrichments = void 0;
exports.mergeBooks = mergeBooks;
exports.mergeAuthors = mergeAuthors;
const prisma_1 = require("../lib/prisma");
const api = __importStar(require("./inventaire.api"));
// Re-export everything from the API so dependents don't break
__exportStar(require("./inventaire.api"), exports);
// ─── Deduplication / Concurrency ─────────────────────────────────────────────
// Instead of a Set that ignores concurrent requests, we use a Map of Promises.
// This ensures that concurrent calls wait for the same result.
exports.activeAuthorEnrichments = new Map();
// ─── DB Services ─────────────────────────────────────────────────────────────
/**
 * Merges a source book into a target book, moving all quotes and reviews,
 * then deleting the source book.
 */
function mergeBooks(sourceId, targetId, tx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (sourceId === targetId)
            return;
        console.log(`[Inventaire Service] Merging book ${sourceId} into ${targetId}...`);
        const operation = (client) => __awaiter(this, void 0, void 0, function* () {
            // Move quotes
            yield client.quote.updateMany({
                where: { bookId: sourceId },
                data: { bookId: targetId }
            });
            // Move reviews
            yield client.review.updateMany({
                where: { bookId: sourceId },
                data: { bookId: targetId }
            });
            // Delete source book
            yield client.book.delete({ where: { id: sourceId } });
        });
        try {
            if (tx) {
                yield operation(tx);
            }
            else {
                yield prisma_1.prisma.$transaction((newTx) => __awaiter(this, void 0, void 0, function* () { return yield operation(newTx); }));
            }
            console.log(`[Inventaire Service] Merge successful. Source book ${sourceId} deleted.`);
        }
        catch (e) {
            console.error(`[Inventaire Service] Merge failed between books ${sourceId} and ${targetId}:`, e);
            throw e;
        }
    });
}
/**
 * Merges a source author into a target author, moving all books, quotes and followers,
 * then deleting the source author.
 */
function mergeAuthors(sourceId, targetId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (sourceId === targetId)
            return;
        console.log(`[Inventaire Service] Merging author ${sourceId} into ${targetId}...`);
        try {
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // 1. Move books one by one to handle title conflicts
                const sourceBooks = yield tx.book.findMany({ where: { authorId: sourceId } });
                for (const book of sourceBooks) {
                    const conflict = yield tx.book.findFirst({
                        where: {
                            authorId: targetId,
                            OR: [
                                { title: book.title },
                                ...(book.inventaireUri ? [{ inventaireUri: book.inventaireUri }] : [])
                            ]
                        }
                    });
                    if (conflict) {
                        yield mergeBooks(book.id, conflict.id, tx);
                    }
                    else {
                        yield tx.book.update({
                            where: { id: book.id },
                            data: { authorId: targetId }
                        });
                    }
                }
                // 2. Move quotes
                yield tx.quote.updateMany({
                    where: { authorId: sourceId },
                    data: { authorId: targetId }
                });
                // 3. Move followers (UserAuthor)
                const sourceFollowers = yield tx.userAuthor.findMany({
                    where: { authorId: sourceId }
                });
                for (const follow of sourceFollowers) {
                    const alreadyFollowing = yield tx.userAuthor.findUnique({
                        where: {
                            userId_authorId: {
                                userId: follow.userId,
                                authorId: targetId
                            }
                        }
                    });
                    if (!alreadyFollowing) {
                        yield tx.userAuthor.create({
                            data: {
                                userId: follow.userId,
                                authorId: targetId,
                                addedAt: follow.addedAt
                            }
                        });
                    }
                }
                // 4. Delete source author
                yield tx.author.delete({ where: { id: sourceId } });
            }));
            console.log(`[Inventaire Service] Merge successful. Source author ${sourceId} deleted.`);
        }
        catch (e) {
            console.error(`[Inventaire Service] Merge failed between authors ${sourceId} and ${targetId}:`, e);
            throw e;
        }
    });
}
const enrichWorkMetadata = (uri) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log(`[Inventaire Service] Starting full enrichment for ${uri}`);
    const details = yield api.getInventaireWorkDetails(uri);
    if (!details)
        return null;
    const nativeUri = details.uri;
    const result = {
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
        const authorEntities = yield api.getInventaireEntities([details.authorUris[0]]);
        const authorEntry = authorEntities[details.authorUris[0]];
        if (authorEntry && authorEntry.labels) {
            result.authors = [authorEntry.labels['fr'] || authorEntry.labels['en'] || Object.values(authorEntry.labels)[0]];
        }
    }
    if (details.wikipediaTitle) {
        const synopsis = yield api.fetchWikipediaSynopsis(details.wikipediaTitle, 'fr');
        if (synopsis) {
            result.description = synopsis;
            console.log(`[Inventaire Service] Found Wikipedia (FR) synopsis: ${synopsis}`);
        }
    }
    try {
        const searchMetadata = yield api.getBatchInventaireSearchMetadata([uri]);
        if (api.isNativeScan((_a = searchMetadata[uri]) === null || _a === void 0 ? void 0 : _a.image)) {
            result.image = searchMetadata[uri].image;
        }
        const editions = yield api.getWorkEditions(nativeUri);
        result.editions = editions;
        if (editions.length > 0) {
            const scoredEds = editions.map(e => {
                var _a;
                let score = 0;
                if (e.languageUri === 'wd:Q150')
                    score += 10;
                if ((_a = e.cover) === null || _a === void 0 ? void 0 : _a.includes('/img/entities/'))
                    score += 5;
                if (e.isbn)
                    score += 2;
                if (e.pages && e.pages > 0)
                    score += 1;
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
    }
    catch (err) {
        console.error(`[Inventaire Service] Failed to fetch editions for pages/covers`, err);
    }
    return result;
});
exports.enrichWorkMetadata = enrichWorkMetadata;
const syncAuthorProfile = (authorId, authorName, authorUri) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Deduplication using Promises
    if (exports.activeAuthorEnrichments.has(authorId)) {
        console.log(`[Inventaire Service] Joining existing enrichment for author ID: ${authorId}`);
        return exports.activeAuthorEnrichments.get(authorId);
    }
    const enrichmentPromise = (() => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        try {
            yield prisma_1.prisma.author.update({ where: { id: authorId }, data: { isEnriching: true } }).catch(e => console.error(`Failed to set isEnriching for ${authorId}`, e));
            const author = yield prisma_1.prisma.author.findUnique({ where: { id: authorId } });
            if (!author)
                return null;
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
                const searchResults = yield api.searchInventaireAuthors(nameToSearch, 5);
                if (searchResults.length > 0) {
                    const match = searchResults.find(r => r.label.toLowerCase() === nameToSearch.toLowerCase()) || searchResults[0];
                    uri = match.uri;
                }
            }
            if (!uri)
                return null;
            // 2. Check for conflict: Does another author record already use this URI?
            const existingWithUri = yield prisma_1.prisma.author.findUnique({ where: { inventaireUri: uri } });
            if (existingWithUri && existingWithUri.id !== authorId) {
                console.log(`[Inventaire Service] ⚠️ Conflict detected: Author ${existingWithUri.id} already has URI ${uri}. Merging...`);
                yield mergeAuthors(authorId, existingWithUri.id);
                // Recursively call sync for the survivor and return its result
                return yield (0, exports.syncAuthorProfile)(existingWithUri.id, authorName, uri);
            }
            const details = yield api.getInventaireAuthorDetails(uri);
            if (!details)
                return null;
            const isNewEntity = uri !== author.inventaireUri;
            let biography = isNewEntity ? null : author.description;
            if (details.wikipediaTitle && (isNewEntity || !biography || biography.length < 50)) {
                const synopsis = yield api.fetchWikipediaSynopsis(details.wikipediaTitle, 'fr');
                if (synopsis) {
                    biography = synopsis;
                }
            }
            const updateData = { inventaireUri: uri };
            if (details.name && author.name !== details.name) {
                const conflict = yield prisma_1.prisma.author.findUnique({ where: { name: details.name } });
                if (!conflict)
                    updateData.name = details.name;
            }
            updateData.description = isNewEntity ? biography : (biography || author.description);
            updateData.image = isNewEntity ? details.image : (details.image || author.image);
            updateData.birthDate = isNewEntity ? details.birthDate : (details.birthDate || author.birthDate);
            updateData.nationality = isNewEntity ? details.nationality : (details.nationality || author.nationality);
            if (updateData.nationality && (updateData.nationality.startsWith('wd:') || updateData.nationality.startsWith('inv:'))) {
                try {
                    const natEntities = yield api.getInventaireEntities([updateData.nationality]);
                    const natEntity = natEntities[updateData.nationality];
                    if (natEntity && natEntity.labels) {
                        updateData.nationality = natEntity.labels['fr'] || natEntity.labels['en'] || Object.values(natEntity.labels)[0];
                    }
                }
                catch (err) {
                    console.error(`[Inventaire Service] Failed to resolve nationality label`, err);
                }
            }
            updateData.lastEnrichedAt = new Date();
            let updatedAuthor;
            try {
                updatedAuthor = yield prisma_1.prisma.author.update({
                    where: { id: authorId },
                    data: updateData
                });
            }
            catch (err) {
                if (err.code === 'P2002' && ((_b = (_a = err.meta) === null || _a === void 0 ? void 0 : _a.target) === null || _b === void 0 ? void 0 : _b.includes('inventaireUri'))) {
                    console.log(`[Inventaire Service] Race condition: Author with URI ${uri} was created/updated concurrently. Merging...`);
                    const survivor = yield prisma_1.prisma.author.findUnique({ where: { inventaireUri: uri } });
                    if (survivor) {
                        yield mergeAuthors(authorId, survivor.id);
                        return yield (0, exports.syncAuthorProfile)(survivor.id, authorName, uri);
                    }
                }
                throw err;
            }
            console.log(`[Inventaire Service] Enrichment complete for ${updatedAuthor.name}`);
            return updatedAuthor;
        }
        catch (e) {
            console.error(`[Inventaire Service] Author enrichment error:`, e);
            return null;
        }
        finally {
            // We might have deleted the author during merge, so check if it still exists before clearing flag
            const exists = yield prisma_1.prisma.author.findUnique({ where: { id: authorId }, select: { id: true } });
            if (exists) {
                yield prisma_1.prisma.author.update({ where: { id: authorId }, data: { isEnriching: false } }).catch(e => console.error(`Failed to clear isEnriching for ${authorId}`, e));
            }
            exports.activeAuthorEnrichments.delete(authorId);
        }
    }))();
    exports.activeAuthorEnrichments.set(authorId, enrichmentPromise);
    return enrichmentPromise;
});
exports.syncAuthorProfile = syncAuthorProfile;
const discoverAuthorWorks = (authorId, authorUri) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const author = yield prisma_1.prisma.author.findUnique({ where: { id: authorId } });
        if (!author)
            return;
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        const lastDiscovered = author.lastDiscoveredAt ? new Date(author.lastDiscoveredAt).getTime() : 0;
        const isDiscoveryFresh = (now - lastDiscovered) < SEVEN_DAYS;
        if (isDiscoveryFresh) {
            console.log(`[Inventaire Service] Author ${author.name} works already discovered recently. Skipping.`);
            return;
        }
        const uri = authorUri || author.inventaireUri;
        if (!uri)
            return;
        console.log(`[Inventaire Service] Discovering all works for author: ${author.name} (${uri})`);
        const workUris = yield api.getAuthorWorkUris(uri);
        if (workUris.length > 0) {
            const limitedUris = workUris.slice(0, 100);
            const CHUNK_SIZE = 25;
            for (let i = 0; i < limitedUris.length; i += CHUNK_SIZE) {
                const chunk = limitedUris.slice(i, i + CHUNK_SIZE);
                const [workEntities, bestCovers] = yield Promise.all([
                    api.getBatchInventaireDetails(chunk),
                    api.getBestNativeCovers(chunk)
                ]);
                for (const [wUri, details] of Object.entries(workEntities)) {
                    if (!details || !details.title)
                        continue;
                    const bestCover = bestCovers[wUri];
                    const finalCover = bestCover || details.image || null;
                    const bookTitle = details.title.trim();
                    const existingBook = yield prisma_1.prisma.book.findFirst({
                        where: {
                            OR: [
                                { inventaireUri: wUri },
                                { AND: [{ title: bookTitle }, { authorId: author.id }] }
                            ]
                        }
                    });
                    if (!existingBook) {
                        try {
                            yield prisma_1.prisma.book.create({
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
                        }
                        catch (err) {
                            if (err.code === 'P2002') {
                                console.log(`[Inventaire Service] Book "${bookTitle}" already exists (race condition), skipping.`);
                            }
                        }
                    }
                    else if (!existingBook.inventaireUri) {
                        yield prisma_1.prisma.book.update({
                            where: { id: existingBook.id },
                            data: { inventaireUri: wUri }
                        }).catch(e => console.error(`Failed to update book ${existingBook.id}`, e));
                    }
                }
            }
        }
        yield prisma_1.prisma.author.update({
            where: { id: authorId },
            data: { lastDiscoveredAt: new Date() }
        }).catch(e => console.error(`Failed to update lastDiscoveredAt for ${authorId}`, e));
    }
    catch (e) {
        console.error(`[Inventaire Service] Author discovery error:`, e);
    }
});
exports.discoverAuthorWorks = discoverAuthorWorks;
const enrichAuthorWithInventaire = (authorId_1, authorName_1, authorUri_1, ...args_1) => __awaiter(void 0, [authorId_1, authorName_1, authorUri_1, ...args_1], void 0, function* (authorId, authorName, authorUri, skipDiscovery = false) {
    const author = yield (0, exports.syncAuthorProfile)(authorId, authorName, authorUri);
    if (!author)
        return null;
    if (!skipDiscovery && author.inventaireUri) {
        yield (0, exports.discoverAuthorWorks)(authorId, author.inventaireUri);
    }
    return author;
});
exports.enrichAuthorWithInventaire = enrichAuthorWithInventaire;
