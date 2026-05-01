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
exports.getBestNativeCovers = exports.getWorkEditions = exports.getEditionsDetails = exports.getAuthorWorkUris = exports.getWorkEditionUris = exports.getBatchInventaireDetails = exports.fetchWikipediaSynopsis = exports.getInventaireAuthorDetails = exports.getInventaireWorkDetails = exports.getBatchInventaireSearchMetadata = exports.getInventaireEntities = exports.findWorkUriByTitleAndAuthor = exports.searchInventaireAuthors = exports.searchInventaireWorks = exports.searchInventaire = exports.formatInventaireWork = exports.formatInventaireDate = exports.safeFirstClaim = exports.getEntityImage = exports.isNativeScan = exports.resolveImageUrl = exports.fetchWithAgent = exports.INVENTAIRE_BASE = void 0;
exports.INVENTAIRE_BASE = 'https://inventaire.io';
// ─── HTTP Client ─────────────────────────────────────────────────────────────
const USER_AGENT = 'QuotexApp/1.0 (chantreau@example.com)'; // Replace with actual email later if needed
const fetchWithAgent = (url_1, ...args_1) => __awaiter(void 0, [url_1, ...args_1], void 0, function* (url, options = {}) {
    const headers = Object.assign({ 'User-Agent': USER_AGENT }, (options.headers || {}));
    return fetch(url, Object.assign(Object.assign({}, options), { headers }));
});
exports.fetchWithAgent = fetchWithAgent;
// ─── Helpers ──────────────────────────────────────────────────────────────────
const resolveImageUrl = (raw) => {
    if (!raw)
        return null;
    if (raw.startsWith('http'))
        return raw;
    if (raw.startsWith('/img/'))
        return `${exports.INVENTAIRE_BASE}${raw}`;
    return null;
};
exports.resolveImageUrl = resolveImageUrl;
const isNativeScan = (url) => {
    return !!(url && url.includes('/img/entities/'));
};
exports.isNativeScan = isNativeScan;
const getEntityImage = (imageObj) => {
    if (!imageObj)
        return null;
    if (typeof imageObj === 'string')
        return (0, exports.resolveImageUrl)(imageObj);
    if (imageObj.file && imageObj.file.startsWith('/img/')) {
        return (0, exports.resolveImageUrl)(imageObj.file);
    }
    return (0, exports.resolveImageUrl)(imageObj.url);
};
exports.getEntityImage = getEntityImage;
const safeFirstClaim = (claims, property) => {
    var _a, _b;
    return (_b = (_a = claims === null || claims === void 0 ? void 0 : claims[property]) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null;
};
exports.safeFirstClaim = safeFirstClaim;
const formatInventaireDate = (rawDate) => {
    if (!rawDate)
        return null;
    let cleanDate = rawDate.startsWith('+') ? rawDate.substring(1) : rawDate;
    if (cleanDate.includes('-00-00')) {
        return cleanDate.split('-')[0];
    }
    try {
        const date = new Date(cleanDate);
        if (isNaN(date.getTime()))
            return rawDate;
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
    catch (e) {
        return rawDate;
    }
};
exports.formatInventaireDate = formatInventaireDate;
const formatInventaireWork = (entity, uri) => {
    var _a, _b;
    if (!entity)
        return {};
    const claims = entity.claims || {};
    const labels = entity.labels || {};
    const label = labels['fr'] || labels['en'] || entity.label || Object.values(labels)[0] || null;
    const publishDateRaw = (0, exports.safeFirstClaim)(claims, 'wdt:P577');
    const year = publishDateRaw ? parseInt(publishDateRaw.substring(0, 4)) : null;
    const imageUrl = (0, exports.getEntityImage)(entity.image);
    const sitelinks = entity.sitelinks || {};
    const pagesClaim = (0, exports.safeFirstClaim)(claims, 'wdt:P1104');
    return {
        uri: entity.uri || uri,
        title: label,
        year,
        image: imageUrl,
        authorUris: claims['wdt:P50'] || [],
        genreUris: claims['wdt:P136'] || [],
        wikipediaTitle: ((_a = sitelinks['frwiki']) === null || _a === void 0 ? void 0 : _a.title) || ((_b = sitelinks['enwiki']) === null || _b === void 0 ? void 0 : _b.title) || null,
        pages: pagesClaim ? parseInt(pagesClaim) : null,
        label: label
    };
};
exports.formatInventaireWork = formatInventaireWork;
// ─── API: Search ─────────────────────────────────────────────────────────────
const searchInventaire = (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, types = 'works', limit = 10) {
    var _a;
    if (!query.trim())
        return [];
    console.log(`[Inventaire API] Searching for "${query}" (types: ${types})`);
    try {
        const typesList = types.split(',');
        const typesParam = typesList.map(t => `types=${encodeURIComponent(t.trim())}`).join('&');
        const url = `${exports.INVENTAIRE_BASE}/api/search?${typesParam}&search=${encodeURIComponent(query)}&limit=${limit}&lang=fr`;
        const response = yield (0, exports.fetchWithAgent)(url);
        if (!response.ok)
            throw new Error(`Inventaire search error: ${response.status}`);
        const data = yield response.json();
        const basicResults = (data.results || []).map((r) => ({
            id: r.id,
            uri: r.uri,
            type: r.type,
            label: r.label || '',
            image: (0, exports.resolveImageUrl)(r.image),
            authors: []
        }));
        if (basicResults.length === 0)
            return [];
        const urisToFetch = basicResults.map(r => r.uri);
        const entities = yield (0, exports.getInventaireEntities)(urisToFetch);
        const authorUrisToFetch = new Set();
        for (const uri of urisToFetch) {
            const entity = entities[uri];
            if ((_a = entity === null || entity === void 0 ? void 0 : entity.claims) === null || _a === void 0 ? void 0 : _a['wdt:P50']) {
                entity.claims['wdt:P50'].forEach(aUri => authorUrisToFetch.add(aUri));
            }
        }
        const authorNamesByUri = {};
        if (authorUrisToFetch.size > 0) {
            const authorEntities = yield (0, exports.getInventaireEntities)(Array.from(authorUrisToFetch));
            for (const [aUri, aEntity] of Object.entries(authorEntities)) {
                if (aEntity === null || aEntity === void 0 ? void 0 : aEntity.labels) {
                    authorNamesByUri[aUri] = aEntity.labels['fr'] || aEntity.labels['en'] || Object.values(aEntity.labels)[0] || 'Unknown';
                }
            }
        }
        for (const result of basicResults) {
            const entity = entities[result.uri];
            if (entity) {
                const claims = entity.claims || {};
                const labels = entity.labels || {};
                const label = labels['fr'] || labels['en'] || entity.label || Object.values(labels)[0] || result.label;
                result.label = label;
                result.image = (0, exports.getEntityImage)(entity.image) || result.image;
                if (claims['wdt:P50'] && claims['wdt:P50'].length > 0) {
                    result.authors = claims['wdt:P50'].map((aUri) => authorNamesByUri[aUri] || 'Unknown');
                    result.authorUris = claims['wdt:P50'];
                }
            }
        }
        return basicResults;
    }
    catch (e) {
        console.error('[Inventaire API] Error searching:', e);
        return [];
    }
});
exports.searchInventaire = searchInventaire;
const searchInventaireWorks = (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, limit = 10) {
    return (0, exports.searchInventaire)(query, 'works,genres,movements', limit);
});
exports.searchInventaireWorks = searchInventaireWorks;
const searchInventaireAuthors = (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, limit = 10) {
    return (0, exports.searchInventaire)(query, 'humans', limit);
});
exports.searchInventaireAuthors = searchInventaireAuthors;
const findWorkUriByTitleAndAuthor = (title, authorName) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (!title || !authorName)
        return null;
    const cleanTitle = title.trim();
    const cleanAuthor = authorName.trim();
    const searchQuery = `"${cleanTitle}" ${cleanAuthor}`;
    const results = yield (0, exports.searchInventaireWorks)(searchQuery, 20);
    if (results.length === 0)
        return null;
    for (const res of results) {
        const titleMatch = res.label.toLowerCase().trim() === cleanTitle.toLowerCase();
        const authorMatch = ((_a = res.authors) === null || _a === void 0 ? void 0 : _a.some(a => a.toLowerCase().includes(cleanAuthor.toLowerCase()))) || false;
        if (titleMatch && authorMatch)
            return res.uri;
    }
    for (const res of results) {
        const authorMatch = ((_b = res.authors) === null || _b === void 0 ? void 0 : _b.some(a => a.toLowerCase().includes(cleanAuthor.toLowerCase()))) || false;
        if (authorMatch)
            return res.uri;
    }
    return null;
});
exports.findWorkUriByTitleAndAuthor = findWorkUriByTitleAndAuthor;
// ─── API: Entities ───────────────────────────────────────────────────────────
const getInventaireEntities = (uris) => __awaiter(void 0, void 0, void 0, function* () {
    if (!uris.length)
        return {};
    try {
        const uriParam = uris.join('|');
        const url = `${exports.INVENTAIRE_BASE}/api/entities/by-uris?uris=${encodeURIComponent(uriParam)}&lang=fr`;
        const response = yield (0, exports.fetchWithAgent)(url);
        if (!response.ok)
            throw new Error(`Inventaire entities error: ${response.status}`);
        const data = yield response.json();
        return data.entities || {};
    }
    catch (e) {
        console.error('[Inventaire API] Error fetching entities:', e);
        return {};
    }
});
exports.getInventaireEntities = getInventaireEntities;
const getBatchInventaireSearchMetadata = (uris) => __awaiter(void 0, void 0, void 0, function* () {
    if (!uris.length)
        return {};
    const ids = uris.map(uri => {
        if (uri.startsWith('wd:'))
            return uri.substring(3);
        if (uri.startsWith('inv:'))
            return uri.substring(4);
        return null;
    }).filter(Boolean);
    if (ids.length === 0)
        return {};
    const results = {};
    const CHUNK_SIZE = 10;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const searchQuery = chunk.map(id => `id:"${id}"`).join(' OR ');
        try {
            const url = `${exports.INVENTAIRE_BASE}/api/search?types=works&search=${encodeURIComponent(searchQuery)}&limit=${chunk.length}&lang=fr`;
            const response = yield (0, exports.fetchWithAgent)(url);
            if (!response.ok)
                continue;
            const data = yield response.json();
            (data.results || []).forEach((r) => {
                if (r.uri) {
                    results[r.uri] = { image: (0, exports.resolveImageUrl)(r.image), label: r.label || null };
                }
            });
        }
        catch (e) {
            console.error('[Inventaire API] Error in batch search metadata:', e);
        }
    }
    return results;
});
exports.getBatchInventaireSearchMetadata = getBatchInventaireSearchMetadata;
const getInventaireWorkDetails = (uri) => __awaiter(void 0, void 0, void 0, function* () {
    const entities = yield (0, exports.getInventaireEntities)([uri]);
    const entity = entities[uri];
    if (!entity)
        return null;
    const formatted = (0, exports.formatInventaireWork)(entity, uri);
    return {
        uri: formatted.uri,
        title: formatted.title || null,
        image: formatted.image || null,
        authorUris: formatted.authorUris || [],
        year: formatted.year || null,
        genreUris: formatted.genreUris || [],
        wikipediaTitle: formatted.wikipediaTitle || null,
        pages: formatted.pages || null,
    };
});
exports.getInventaireWorkDetails = getInventaireWorkDetails;
const getInventaireAuthorDetails = (uri) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const entities = yield (0, exports.getInventaireEntities)([uri]);
    const entity = entities[uri];
    if (!entity)
        return null;
    const claims = entity.claims || {};
    const labels = entity.labels || {};
    const name = labels['fr'] || labels['en'] || Object.values(labels)[0] || null;
    const birthDate = (0, exports.formatInventaireDate)((0, exports.safeFirstClaim)(claims, 'wdt:P569'));
    const nationalityUri = (0, exports.safeFirstClaim)(claims, 'wdt:P27');
    const imageUrl = (0, exports.getEntityImage)(entity.image);
    const sitelinks = entity.sitelinks || {};
    const wikipediaTitle = ((_a = sitelinks['frwiki']) === null || _a === void 0 ? void 0 : _a.title) || ((_b = sitelinks['enwiki']) === null || _b === void 0 ? void 0 : _b.title) || null;
    return { uri, name, image: imageUrl, birthDate, nationality: nationalityUri, wikipediaTitle };
});
exports.getInventaireAuthorDetails = getInventaireAuthorDetails;
const fetchWikipediaSynopsis = (title_1, ...args_1) => __awaiter(void 0, [title_1, ...args_1], void 0, function* (title, lang = 'fr') {
    var _a, _b;
    if (!title)
        return null;
    try {
        console.log(`[Wikipedia API] Fetching synopsis for: ${title} (${lang})`);
        const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=4&explaintext=1&exintro=1&titles=${encodeURIComponent(title)}&format=json`;
        const response = yield (0, exports.fetchWithAgent)(url);
        if (!response.ok)
            return null;
        const data = yield response.json();
        const pages = (_a = data.query) === null || _a === void 0 ? void 0 : _a.pages;
        if (!pages)
            return null;
        const firstPageId = Object.keys(pages)[0];
        if (firstPageId === '-1')
            return null;
        const extract = (_b = pages[firstPageId]) === null || _b === void 0 ? void 0 : _b.extract;
        if (!extract || extract.trim().length === 0)
            return null;
        return extract.trim();
    }
    catch (e) {
        console.error('[Wikipedia API] Error fetching synopsis:', e);
        return null;
    }
});
exports.fetchWikipediaSynopsis = fetchWikipediaSynopsis;
const getBatchInventaireDetails = (uris) => __awaiter(void 0, void 0, void 0, function* () {
    if (!uris.length)
        return {};
    const entities = yield (0, exports.getInventaireEntities)(uris);
    const results = {};
    for (const [uri, entity] of Object.entries(entities)) {
        if (!entity)
            continue;
        results[uri] = (0, exports.formatInventaireWork)(entity, uri);
    }
    return results;
});
exports.getBatchInventaireDetails = getBatchInventaireDetails;
// ─── API: Editions ───────────────────────────────────────────────────────────
const getWorkEditionUris = (workUri) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const url = `${exports.INVENTAIRE_BASE}/api/entities?action=reverse-claims&property=wdt:P629&value=${encodeURIComponent(workUri)}`;
        const response = yield (0, exports.fetchWithAgent)(url);
        if (!response.ok)
            throw new Error(`Inventaire reverse-claims error: ${response.status}`);
        const data = yield response.json();
        return data.uris || [];
    }
    catch (e) {
        console.error('[Inventaire API] Error fetching edition URIs:', e);
        return [];
    }
});
exports.getWorkEditionUris = getWorkEditionUris;
const getAuthorWorkUris = (authorUri) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const url = `${exports.INVENTAIRE_BASE}/api/entities?action=reverse-claims&property=wdt:P50&value=${encodeURIComponent(authorUri)}`;
        const response = yield (0, exports.fetchWithAgent)(url);
        if (!response.ok)
            throw new Error(`Inventaire reverse-claims error: ${response.status}`);
        const data = yield response.json();
        return data.uris || [];
    }
    catch (e) {
        console.error('[Inventaire API] Error fetching author work URIs:', e);
        return [];
    }
});
exports.getAuthorWorkUris = getAuthorWorkUris;
const getEditionsDetails = (editionUris) => __awaiter(void 0, void 0, void 0, function* () {
    const results = [];
    const CHUNK_SIZE = 15;
    for (let i = 0; i < editionUris.length; i += CHUNK_SIZE) {
        const chunk = editionUris.slice(i, i + CHUNK_SIZE);
        const entities = yield (0, exports.getInventaireEntities)(chunk);
        for (const [uri, e] of Object.entries(entities)) {
            const claims = e.claims || {};
            const labels = e.labels || {};
            const isbn = (0, exports.safeFirstClaim)(claims, 'wdt:P212');
            const title = (0, exports.safeFirstClaim)(claims, 'wdt:P1476') || labels['fr'] || labels['en'] || labels['fromclaims'] || null;
            const publishDate = (0, exports.safeFirstClaim)(claims, 'wdt:P577');
            const publisherUri = (0, exports.safeFirstClaim)(claims, 'wdt:P123');
            const languageUri = (0, exports.safeFirstClaim)(claims, 'wdt:P407');
            const pagesRaw = (0, exports.safeFirstClaim)(claims, 'wdt:P1104');
            const cover = (0, exports.getEntityImage)(e.image);
            results.push({
                inventaireUri: uri,
                isbn,
                title,
                publishDate: publishDate ? publishDate.substring(0, 4) : null,
                publisherUri,
                languageUri,
                cover,
                pages: pagesRaw ? parseInt(pagesRaw) : null,
            });
        }
    }
    return results;
});
exports.getEditionsDetails = getEditionsDetails;
const getWorkEditions = (workUri) => __awaiter(void 0, void 0, void 0, function* () {
    const uris = yield (0, exports.getWorkEditionUris)(workUri);
    if (!uris.length)
        return [];
    return (0, exports.getEditionsDetails)(uris.slice(0, 30));
});
exports.getWorkEditions = getWorkEditions;
const getBestNativeCovers = (workUris) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!workUris.length)
        return {};
    const results = {};
    try {
        const editionUrisPerWork = yield Promise.all(workUris.map((uri) => __awaiter(void 0, void 0, void 0, function* () {
            const edUris = yield (0, exports.getWorkEditionUris)(uri);
            return { workUri: uri, edUris };
        })));
        const allEdUris = editionUrisPerWork.flatMap(x => x.edUris.slice(0, 10));
        if (allEdUris.length === 0)
            return results;
        const allEdDetails = yield (0, exports.getEditionsDetails)(allEdUris);
        const searchMetadata = yield (0, exports.getBatchInventaireSearchMetadata)(workUris);
        for (const { workUri, edUris } of editionUrisPerWork) {
            const searchImg = (_a = searchMetadata[workUri]) === null || _a === void 0 ? void 0 : _a.image;
            if ((0, exports.isNativeScan)(searchImg)) {
                results[workUri] = searchImg;
                continue;
            }
            const eds = allEdDetails.filter(d => edUris.includes(d.inventaireUri));
            if (eds.length === 0)
                continue;
            const bestEd = eds.sort((a, b) => {
                var _a, _b;
                let scoreA = 0, scoreB = 0;
                if (a.languageUri === 'wd:Q150')
                    scoreA += 10;
                if ((_a = a.cover) === null || _a === void 0 ? void 0 : _a.includes('/img/entities/'))
                    scoreA += 5;
                if (a.isbn)
                    scoreA += 2;
                if ((a.pages || 0) > 0)
                    scoreA += 1;
                if (b.languageUri === 'wd:Q150')
                    scoreB += 10;
                if ((_b = b.cover) === null || _b === void 0 ? void 0 : _b.includes('/img/entities/'))
                    scoreB += 5;
                if (b.isbn)
                    scoreB += 2;
                if ((b.pages || 0) > 0)
                    scoreB += 1;
                return scoreB - scoreA;
            })[0];
            if (bestEd === null || bestEd === void 0 ? void 0 : bestEd.cover)
                results[workUri] = bestEd.cover;
        }
    }
    catch (err) {
        console.error(`[Inventaire API] Error in getBestNativeCovers:`, err);
    }
    return results;
});
exports.getBestNativeCovers = getBestNativeCovers;
