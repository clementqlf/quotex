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
const searchHybrid = (query) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Search Open Library for structure (Works)
    const olResults = yield (0, openLibrary_1.searchOpenLibraryWorks)(query);
    // 2. Enhance top results with Google Books data
    // We only take the top 5 to avoid spamming Google API
    const enhancedResults = yield Promise.all(olResults.slice(0, 5).map((olWork) => __awaiter(void 0, void 0, void 0, function* () {
        let bestMatch = null;
        // Try to find a match via ISBN first (most precise)
        if (olWork.isbn && olWork.isbn.length > 0) {
            // Try the first few ISBNs until we get a hit
            for (const isbn of olWork.isbn.slice(0, 3)) {
                const gbResults = yield (0, googleBooks_1.searchGoogleBooks)(`isbn:${isbn}`);
                if (gbResults.length > 0) {
                    bestMatch = gbResults[0];
                    break;
                }
            }
        }
        // If no ISBN match or no ISBNs, try searching by Title + Author
        if (!bestMatch) {
            const author = olWork.author_name ? olWork.author_name[0] : '';
            const searchQ = `${olWork.title} ${author}`;
            const gbResults = yield (0, googleBooks_1.searchGoogleBooks)(searchQ);
            if (gbResults.length > 0) {
                bestMatch = gbResults[0];
            }
        }
        // Construct the final object
        return {
            googleId: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.googleId) || `ol-${olWork.key.replace('/works/', '')}`,
            openLibraryId: olWork.key,
            title: olWork.title,
            authors: olWork.author_name || ((bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.authors) || ['Unknown']),
            description: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.description) || '',
            year: olWork.first_publish_year || (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.year) || null,
            pages: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.pages) || null,
            cover: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.cover) || null,
            genre: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.genre) || null,
            isbn: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.isbn) || (olWork.isbn ? olWork.isbn[0] : null),
            rating: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.rating) || null,
            buyLink: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.buyLink) || null,
            price: (bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.price) || null
        };
    })));
    return enhancedResults;
});
exports.searchHybrid = searchHybrid;
