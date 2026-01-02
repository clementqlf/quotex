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
exports.searchOpenLibraryWorks = void 0;
const searchOpenLibraryWorks = (query) => __awaiter(void 0, void 0, void 0, function* () {
    if (!query)
        return [];
    try {
        const response = yield fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`);
        if (!response.ok)
            throw new Error(`OpenLibrary API error: ${response.statusText}`);
        const data = yield response.json();
        return data.docs || [];
    }
    catch (e) {
        console.error('Error searching OpenLibrary:', e);
        return [];
    }
});
exports.searchOpenLibraryWorks = searchOpenLibraryWorks;
