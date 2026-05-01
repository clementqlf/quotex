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
exports.getNotableWorksDetailed = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Fetches notable works (P800) for an author via Wikidata.
 * Lightweight version: returns only URIs and titles.
 */
const getNotableWorksDetailed = (authorName) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        console.log(`[NotableWorks] Fetching curated notable works from Wikidata for: ${authorName}`);
        const sparql = `
          SELECT ?oeuvre ?oeuvreLabel WHERE {
            ?hugo rdfs:label "${authorName}"@fr .
            ?hugo wdt:P31 wd:Q5 . 
            ?hugo wdt:P800 ?oeuvre .
            SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
          }
          ORDER BY ?oeuvreLabel
        `;
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
        const res = yield fetch(url, {
            headers: {
                'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
                'Accept': 'application/sparql-results+json'
            }
        });
        if (!res.ok)
            throw new Error(`SPARQL failed: ${res.status}`);
        const data = yield res.json();
        const results = data.results.bindings;
        const uniqueWorks = new Map();
        for (const item of results) {
            const qid = (_b = (_a = item.oeuvre) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.split('/entity/')[1];
            const uri = qid ? `wd:${qid}` : null;
            const title = ((_c = item.oeuvreLabel) === null || _c === void 0 ? void 0 : _c.value) || 'Sans titre';
            if (uri && !uniqueWorks.has(title)) {
                uniqueWorks.set(title, { title, uri });
            }
        }
        return Array.from(uniqueWorks.values());
    }
    catch (e) {
        console.error('[NotableWorks] Wikidata error:', e);
        return [];
    }
});
exports.getNotableWorksDetailed = getNotableWorksDetailed;
