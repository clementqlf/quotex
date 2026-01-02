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
exports.getSimilarBooks = exports.searchGoogleBooks = void 0;
const searchGoogleBooks = (query) => __awaiter(void 0, void 0, void 0, function* () {
    if (!query)
        return [];
    try {
        const response = yield fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20`);
        if (!response.ok) {
            throw new Error(`Google Books API error: ${response.statusText}`);
        }
        const data = yield response.json();
        if (!data.items)
            return [];
        return data.items.map((item) => {
            var _a, _b, _c, _d, _e;
            const info = item.volumeInfo;
            const sale = item.saleInfo;
            // Extract ISBN-13 if available, otherwise 10
            const isbnObj = ((_a = info.industryIdentifiers) === null || _a === void 0 ? void 0 : _a.find(id => id.type === 'ISBN_13'))
                || ((_b = info.industryIdentifiers) === null || _b === void 0 ? void 0 : _b.find(id => id.type === 'ISBN_10'));
            // Format price if available
            let priceString = null;
            if (sale === null || sale === void 0 ? void 0 : sale.retailPrice) {
                priceString = `${sale.retailPrice.amount} ${sale.retailPrice.currencyCode}`;
            }
            else if (sale === null || sale === void 0 ? void 0 : sale.listPrice) {
                priceString = `${sale.listPrice.amount} ${sale.listPrice.currencyCode}`;
            }
            return {
                googleId: item.id,
                title: info.title,
                authors: info.authors || ['Unknown Author'],
                description: info.description || '',
                year: info.publishedDate ? parseInt(info.publishedDate.substring(0, 4)) : null,
                pages: info.pageCount || null,
                cover: ((_d = (_c = info.imageLinks) === null || _c === void 0 ? void 0 : _c.thumbnail) === null || _d === void 0 ? void 0 : _d.replace('http:', 'https:')) || null, // Ensure HTTPS
                genre: ((_e = info.categories) === null || _e === void 0 ? void 0 : _e[0]) || null,
                isbn: (isbnObj === null || isbnObj === void 0 ? void 0 : isbnObj.identifier) || null,
                rating: info.averageRating || null,
                buyLink: (sale === null || sale === void 0 ? void 0 : sale.buyLink) || null,
                price: priceString
            };
        });
    }
    catch (error) {
        console.error('Error searching Google Books:', error);
        return [];
    }
});
exports.searchGoogleBooks = searchGoogleBooks;
const getSimilarBooks = (genre, author, currentGoogleId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let query = '';
        if (genre) {
            query = `subject:${genre}`;
        }
        else if (author) {
            query = `inauthor:${author}`;
        }
        else {
            return [];
        }
        const books = yield (0, exports.searchGoogleBooks)(query);
        // Filter out the current book
        return books.filter(b => b.googleId !== currentGoogleId).slice(0, 5);
    }
    catch (error) {
        console.error('Error fetching similar books:', error);
        return [];
    }
});
exports.getSimilarBooks = getSimilarBooks;
