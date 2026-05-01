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
exports.getExternalAuthorBooks = exports.searchExternalAuthors = void 0;
const openLibrary_1 = require("./openLibrary");
const wikidata_1 = require("./wikidata");
const searchExternalAuthors = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const results = yield (0, openLibrary_1.searchOpenLibraryAuthors)(query);
    return results.map(r => ({
        name: r.name,
        key: r.key,
        topWork: r.top_work,
        workCount: r.work_count,
        birthDate: r.birth_date,
        image: `https://covers.openlibrary.org/a/olid/${r.key}-M.jpg`
    }));
});
exports.searchExternalAuthors = searchExternalAuthors;
const getExternalAuthorBooks = (authorName, authorOlid) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Resolve Wikidata QID
    let qid = yield (0, wikidata_1.searchAuthorQid)(authorName);
    // Fallback: If no QID found by name, we could theoretically use OLID to find QID,
    // but Wikidata search by name is usually robust enough for notable authors.
    if (!qid) {
        console.log(`[ExternalAuthor] No QID found for ${authorName}`);
        return [];
    }
    console.log(`[ExternalAuthor] Found QID ${qid} for ${authorName}`);
    // 2. Fetch Works from Wikidata
    const works = yield (0, wikidata_1.getAuthorWorks)(qid);
    console.log(`[ExternalAuthor] Found ${works.length} works for ${authorName}`);
    // 3. Enrich & Format
    const formattedBooks = yield Promise.all(works.map((work) => __awaiter(void 0, void 0, void 0, function* () {
        let cover = null;
        let isbn = null;
        // Try to get cover from Open Library if ID exists
        if (work.openLibraryId) {
            cover = `https://covers.openlibrary.org/b/id/${work.openLibraryId}-L.jpg`; // Note: This might need 'olid' or specific ID type check. 
            // P648 in Wikidata is "Open Library ID" which is usually the Work ID (OL...W) or Edition ID (OL...M). 
            // Covers API works with OLID.
        }
        // Deep fallback for cover if missing (Optional, maybe too slow to do for ALL)
        // For now, let's stick to what we have. If we really need covers, we can lazy load or batch request.
        // As a fast fallback, if no OL ID, we leave cover null. The frontend might handle placeholders.
        // Map to FormattedBook
        return {
            googleId: `wd-${work.qid}`, // Synthetic ID
            openLibraryId: work.openLibraryId,
            title: work.title,
            authors: [authorName],
            description: '', // Wikidata doesn't give good descriptions usually
            year: work.date ? parseInt(work.date.substring(0, 4)) : null,
            pages: null,
            cover: cover,
            genre: work.genres || null,
            isbn: null, // Wikidata ISBNs are often missing or in other properties, not querying for now to keep it fast
            rating: null,
            buyLink: null,
            price: null
        };
    })));
    // Deduplication happens in the calling layer or here? 
    // Wikidata usually is decent, but let's do a simple Title dedupe just in case
    const seenTitles = new Set();
    const uniqueBooks = [];
    for (const book of formattedBooks) {
        const normalizedTitle = book.title.toLowerCase().trim();
        if (!seenTitles.has(normalizedTitle)) {
            seenTitles.add(normalizedTitle);
            uniqueBooks.push(book);
        }
    }
    return uniqueBooks;
});
exports.getExternalAuthorBooks = getExternalAuthorBooks;
