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
exports.getAuthorNationality = exports.getAuthorWorks = exports.searchAuthorQid = void 0;
/**
 * Searches for an author's Wikidata QID by name.
 */
const searchAuthorQid = (authorName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(authorName)}&language=fr&format=json&origin=*&type=item`;
        const res = yield fetch(url, {
            headers: { 'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)' }
        });
        if (!res.ok)
            return null;
        const data = yield res.json();
        if (data.search && data.search.length > 0) {
            return data.search[0].id;
        }
        return null;
    }
    catch (e) {
        console.error(`[Wikidata] Error searching QID for ${authorName}:`, e);
        return null;
    }
});
exports.searchAuthorQid = searchAuthorQid;
/**
 * Fetches works by an author using their Wikidata QID.
 * Uses a refined query to prioritize notable works (with a Wikipedia article)
 * and aggregates genres.
 */
const getAuthorWorks = (qid) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sparql = `
        SELECT ?oeuvre ?title ?openLibraryID ?cover ?pubDate ?genres WHERE {
          {
            SELECT ?oeuvre (SAMPLE(?openLibraryID_val) as ?openLibraryID) (SAMPLE(?cover_val) as ?cover) (SAMPLE(?pubDate_val) as ?pubDate) (GROUP_CONCAT(DISTINCT ?genreLabel; separator=", ") as ?genres) 
            WHERE {
              VALUES ?auteur { wd:${qid} }
              ?oeuvre wdt:P50 ?auteur .
              ?article schema:about ?oeuvre ;
                       schema:isPartOf <https://fr.wikipedia.org/> .
              ?oeuvre wdt:P648 ?openLibraryID_val .
              OPTIONAL { ?oeuvre wdt:P18 ?cover_val. }
              OPTIONAL { ?oeuvre wdt:P577 ?pubDate_val. }
              OPTIONAL { 
                ?oeuvre wdt:P136 ?genre. 
                ?genre rdfs:label ?genreLabel .
                FILTER(LANG(?genreLabel) = "fr")
              }
            }
            GROUP BY ?oeuvre
          }
          OPTIONAL { ?oeuvre rdfs:label ?lblFr . FILTER(LANG(?lblFr) = "fr") }
          OPTIONAL { ?oeuvre rdfs:label ?lblEn . FILTER(LANG(?lblEn) = "en") }
          BIND(COALESCE(?lblFr, ?lblEn) AS ?title)
        }
        ORDER BY ?title
        `;
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
        console.log(`[Wikidata] Fetching works for QID: ${qid}`);
        const res = yield fetch(url, {
            headers: {
                'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
                'Accept': 'application/sparql-results+json'
            }
        });
        if (!res.ok) {
            console.error(`[Wikidata] Query failed: ${res.status} ${res.statusText}`);
            return [];
        }
        const data = yield res.json();
        const results = data.results.bindings;
        console.log(`[Wikidata] Found ${results.length} works for QID: ${qid}`);
        return results.map((b) => {
            var _a, _b, _c, _d;
            return ({
                qid: b.oeuvre.value.split('/').pop() || '',
                title: ((_a = b.title) === null || _a === void 0 ? void 0 : _a.value) || 'Sans titre',
                date: (_b = b.pubDate) === null || _b === void 0 ? void 0 : _b.value,
                openLibraryId: (_c = b.openLibraryID) === null || _c === void 0 ? void 0 : _c.value,
                genres: (_d = b.genres) === null || _d === void 0 ? void 0 : _d.value
            });
        });
    }
    catch (e) {
        console.error(`[Wikidata] Error fetching works for ${qid}:`, e);
        return [];
    }
});
exports.getAuthorWorks = getAuthorWorks;
/**
 * Fetches the nationality of an author using their Wikidata QID.
 */
const getAuthorNationality = (qid) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const sparql = `
        SELECT (GROUP_CONCAT(DISTINCT ?countryLabel; separator=", ") as ?nationalities) WHERE {
          wd:${qid} wdt:P27 ?country .
          ?country rdfs:label ?countryLabel .
          FILTER(LANG(?countryLabel) = "fr")
        }
        `;
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
        const res = yield fetch(url, {
            headers: {
                'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
                'Accept': 'application/sparql-results+json'
            }
        });
        if (!res.ok)
            return null;
        const data = yield res.json();
        return ((_b = (_a = data.results.bindings[0]) === null || _a === void 0 ? void 0 : _a.nationalities) === null || _b === void 0 ? void 0 : _b.value) || null;
    }
    catch (e) {
        console.error(`[Wikidata] Error fetching nationality for ${qid}:`, e);
        return null;
    }
});
exports.getAuthorNationality = getAuthorNationality;
