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
exports.searchHybrid = void 0;
const openLibrary_1 = require("./openLibrary");
const googleBooks_1 = require("./googleBooks");
// Helper to normalize strings for aggressive deduplication (Pass 1)
const strongNormalize = (str) => {
    return str
        .toLowerCase()
        .split(/[:\(\-]/)[0] // Strip subtitles, parentheticals, or long suffixes
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9]/g, "") // Remove everything except alphanumeric
        .trim();
};
const searchHybrid = (query) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // 1. Search Open Library for structure (Works)
    // Fetch a larger pool of results to ensure we don't miss unique works during deduplication
    const olResults = yield (0, openLibrary_1.searchOpenLibraryWorks)(query);
    // 2. Pass 1: Deduplicate OL results by aggressively normalized Title + Author
    const seenOLKeys = new Set();
    const uniqueOLWorks = [];
    for (const work of olResults) {
        const titleKey = strongNormalize(work.title);
        const authorKey = strongNormalize(((_a = work.author_name) === null || _a === void 0 ? void 0 : _a[0]) || 'unknown');
        const key = `${titleKey}|${authorKey}`;
        if (!seenOLKeys.has(key)) {
            seenOLKeys.add(key);
            uniqueOLWorks.push(work);
        }
        // Take a decent bite for the next step, but not too many to avoid API rate limits
        if (uniqueOLWorks.length >= 8)
            break;
    }
    // 3. Enhance results with Google Books data
    const enrichedResults = yield Promise.all(uniqueOLWorks.map((olWork) => __awaiter(void 0, void 0, void 0, function* () {
        let bestMatch = null;
        // Try precise ISBN match
        if (olWork.isbn && olWork.isbn.length > 0) {
            for (const isbn of olWork.isbn.slice(0, 3)) {
                const gbResults = yield (0, googleBooks_1.searchGoogleBooks)(`isbn:${isbn}`);
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
            const gbResults = yield (0, googleBooks_1.searchGoogleBooks)(searchQ);
            if (gbResults.length > 0) {
                bestMatch = gbResults[0];
            }
        }
        const olCover = olWork.cover_i
            ? `https://covers.openlibrary.org/b/id/${olWork.cover_i}-L.jpg`
            : null;
        return {
            googleId: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.googleId) || `ol-${olWork.key.replace('/works/', '')}`,
            openLibraryId: olWork.key,
            authorOpenLibraryId: olWork.author_key ? olWork.author_key[0] : undefined,
            title: olWork.title,
            authors: olWork.author_name || ((bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.authors) || ['Unknown']),
            description: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.description) || '',
            year: olWork.first_publish_year || (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.year) || null,
            pages: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.pages) || null,
            cover: olCover || (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.cover) || null,
            genre: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.genre) || null,
            isbn: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.isbn) || (olWork.isbn ? olWork.isbn[0] : null),
            rating: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.rating) || null,
            buyLink: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.buyLink) || null,
            price: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.price) || null
        };
    })));
    // 4. Pass 2: Deduplicate results based on Google ID or ISBN
    const finalResults = [];
    const seenIds = new Set();
    for (const book of enrichedResults) {
        // If we have a Google ID, use it as primary deduplicator. Otherwise use ISBN.
        const idKey = book.googleId || (book.isbn ? `isbn-${book.isbn}` : book.openLibraryId);
        if (!seenIds.has(idKey)) {
            seenIds.add(idKey);
            finalResults.push(book);
        }
        // Limit to top 5 final results
        if (finalResults.length >= 5)
            break;
    }
    return finalResults;
});
exports.searchHybrid = searchHybrid;
