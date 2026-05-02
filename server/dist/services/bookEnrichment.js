"use strict";
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
exports.discoverAndEnrichBook = exports.enrichBookWithInventaire = exports.bookEnrichmentQueue = void 0;
const prisma_1 = require("../lib/prisma");
const inventaire_1 = require("./inventaire");
exports.bookEnrichmentQueue = new Set();
/**
 * Specifically enriches a book using Inventaire.io data
 */
const enrichBookWithInventaire = (bookId) => __awaiter(void 0, void 0, void 0, function* () {
    if (exports.bookEnrichmentQueue.has(bookId))
        return null;
    exports.bookEnrichmentQueue.add(bookId);
    try {
        yield prisma_1.prisma.book.update({ where: { id: bookId }, data: { isEnriching: true } }).catch(() => { });
        const book = yield prisma_1.prisma.book.findUnique({ where: { id: bookId } });
        if (!book || !book.inventaireUri)
            return null;
        console.log(`[BookEnrichment] Starting Inventaire enrichment for: ${book.title} (${book.inventaireUri})`);
        const enriched = yield (0, inventaire_1.enrichWorkMetadata)(book.inventaireUri);
        if (enriched) {
            const updateData = {};
            // 1. Standardize Title with Merge logic
            if (enriched.title && book.title !== enriched.title) {
                const targetBook = yield prisma_1.prisma.book.findFirst({
                    where: {
                        title: enriched.title,
                        authorId: book.authorId,
                        NOT: { id: bookId }
                    }
                });
                if (targetBook) {
                    yield (0, inventaire_1.mergeBooks)(bookId, targetBook.id);
                    // If target book didn't have a URI, give it the one we found
                    if (!targetBook.inventaireUri) {
                        yield prisma_1.prisma.book.update({
                            where: { id: targetBook.id },
                            data: { inventaireUri: book.inventaireUri }
                        }).catch(() => { });
                    }
                    return true;
                }
                else {
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
                console.log(`[BookEnrichment] Applying updates to ${book.title}:`, Object.keys(updateData).map(k => `${k}: ${updateData[k]}`).join(', '));
                yield prisma_1.prisma.book.update({
                    where: { id: bookId },
                    data: updateData
                });
            }
            // --- UPSERT Editions ---
            if (enriched.editions && Array.isArray(enriched.editions)) {
                console.log(`[BookEnrichment] Syncing ${enriched.editions.length} editions for ${book.title}`);
                for (const ed of enriched.editions) {
                    yield prisma_1.prisma.edition.upsert({
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
                    }).catch((err) => console.error(`[BookEnrichment] Failed to upsert edition ${ed.inventaireUri}`, err));
                }
            }
            // --- Trigger Author Enrichment with URIs ---
            if (enriched.authorUris && Array.isArray(enriched.authorUris) && book.authorId) {
                for (const authorUri of enriched.authorUris) {
                    console.log(`[BookEnrichment] Triggering direct author enrichment for URI: ${authorUri}`);
                    (0, inventaire_1.enrichAuthorWithInventaire)(book.authorId, undefined, authorUri, true).catch(e => console.error(`[BookEnrichment] Author enrichment failed:`, e));
                }
            }
            return true;
        }
        return null;
    }
    catch (e) {
        console.error(`[BookEnrichment] Inventaire enrichment error for book ${bookId}:`, e);
        return null;
    }
    finally {
        yield prisma_1.prisma.book.update({ where: { id: bookId }, data: { isEnriching: false } }).catch(() => { });
        exports.bookEnrichmentQueue.delete(bookId);
    }
});
exports.enrichBookWithInventaire = enrichBookWithInventaire;
/**
 * Intermediate function that discovers the Inventaire URI for a book
 */
const discoverAndEnrichBook = (bookId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log(`[BookEnrichment/Discovery] Starting discovery for Book ID: ${bookId}`);
    try {
        yield prisma_1.prisma.book.update({ where: { id: bookId }, data: { isEnriching: true } }).catch(() => { });
        const book = yield prisma_1.prisma.book.findUnique({
            where: { id: bookId },
            include: { author: true }
        });
        if (!book) {
            console.log(`[BookEnrichment/Discovery] ❌ Book with ID ${bookId} not found in database.`);
            return;
        }
        if (book.inventaireUri) {
            console.log(`[BookEnrichment/Discovery] Book already has URI: ${book.inventaireUri}. Skipping discovery, going to enrichment.`);
            yield (0, exports.enrichBookWithInventaire)(bookId);
            return;
        }
        const authorName = ((_a = book.author) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown';
        console.log(`[BookEnrichment/Discovery] Attempting to resolve URI for "${book.title}" by "${authorName}"`);
        const uri = yield (0, inventaire_1.findWorkUriByTitleAndAuthor)(book.title, authorName);
        if (uri) {
            console.log(`[BookEnrichment/Discovery] ✅ URI resolved: ${uri}. Checking for conflicts...`);
            const existingBook = yield prisma_1.prisma.book.findUnique({
                where: { inventaireUri: uri }
            });
            if (existingBook && existingBook.id !== bookId) {
                console.log(`[BookEnrichment/Discovery] ⚠️ Conflict detected: Book ${existingBook.id} already has URI ${uri}. Merging...`);
                yield (0, inventaire_1.mergeBooks)(bookId, existingBook.id);
                // Enrichment for the survivor
                yield (0, exports.enrichBookWithInventaire)(existingBook.id);
                return;
            }
            yield prisma_1.prisma.book.update({
                where: { id: bookId },
                data: { inventaireUri: uri }
            });
            console.log(`[BookEnrichment/Discovery] Database updated. Launching full enrichment...`);
            yield (0, exports.enrichBookWithInventaire)(bookId);
        }
        else {
            console.log(`[BookEnrichment/Discovery] ❌ Could not resolve URI for "${book.title}". Enrichment aborted.`);
        }
    }
    catch (e) {
        console.error(`[BookEnrichment/Discovery] ❌ Error during discovery for book ${bookId}:`, e);
    }
});
exports.discoverAndEnrichBook = discoverAndEnrichBook;
