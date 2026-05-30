const USER_AGENT = 'QuotexApp/1.0 (chantreau@example.com)';

const fetchWithAgent = async (url, options = {}, timeoutMs = 8000) => {
    const headers = {
        'User-Agent': USER_AGENT,
        ...(options.headers || {})
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, headers, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

const getInventaireEntities = async (uris) => {
    if (!uris.length) return {};
    const uriParam = uris.join('|');
    const url = `https://inventaire.io/api/entities/by-uris?uris=${encodeURIComponent(uriParam)}&lang=fr&props=labels|descriptions|claims|sitelinks|image`;
    const response = await fetchWithAgent(url);
    const data = await response.json();
    return data.entities || {};
};

const searchInventaire = async (query, types = 'works', limit = 30) => {
    const url = `https://inventaire.io/api/search?types=${encodeURIComponent(types)}&search=${encodeURIComponent(query)}&limit=${limit}&lang=fr`;
    const response = await fetchWithAgent(url);
    const data = await response.json();
    const basicResults = (data.results || []).map(r => ({
        id: r.id,
        uri: r.uri,
        type: r.type,
        label: r.label || '',
        authors: []
    }));

    if (basicResults.length === 0) return [];

    const urisToFetch = basicResults.map(r => r.uri);
    const entities = await getInventaireEntities(urisToFetch);

    const authorUrisToFetch = new Set();
    for (const uri of urisToFetch) {
        const entity = entities[uri];
        if (entity?.claims?.['wdt:P50']) {
            entity.claims['wdt:P50'].forEach(aUri => authorUrisToFetch.add(aUri));
        }
    }

    const authorNamesByUri = {};
    if (authorUrisToFetch.size > 0) {
        const authorEntities = await getInventaireEntities(Array.from(authorUrisToFetch));
        for (const [aUri, aEntity] of Object.entries(authorEntities)) {
            if (aEntity?.labels) {
                authorNamesByUri[aUri] = aEntity.labels['fr'] || aEntity.labels['en'] || Object.values(aEntity.labels)[0] || 'Unknown';
            }
        }
    }

    for (const result of basicResults) {
        const entity = entities[result.uri];
        if (entity) {
            const claims = entity.claims || {};
            const labels = entity.labels || {};
            result.label = labels['fr'] || labels['en'] || entity.label || Object.values(labels)[0] || result.label;
            if (claims['wdt:P50']) {
                result.authors = claims['wdt:P50'].map(aUri => authorNamesByUri[aUri] || 'Unknown');
                result.authorUris = claims['wdt:P50'];
            }
        }
    }
    return basicResults;
};

const normalizeTitle = (t) => {
    return t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^(le\s+|la\s+|les\s+|l'|un\s+|une\s+|des\s+|du\s+|de\s+|d'|the\s+|a\s+|an\s+)/i, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
};

const findWorkUriByTitleAndAuthor = async (title, authorName) => {
    const results = await searchInventaire(title, 'works', 30);
    console.log("Search results total found:", results.length);
    console.log("Search results detail:\n", JSON.stringify(results.map(r => ({ label: r.label, authors: r.authors, uri: r.uri })), null, 2));

    const cleanTitle = title.trim();
    const cleanAuthor = authorName.trim();
    const normTitleQuery = normalizeTitle(cleanTitle);

    // 1. Precise match (Title + Author)
    for (const res of results) {
        const normResTitle = normalizeTitle(res.label);
        const titleMatch = normResTitle === normTitleQuery;
        const authorMatch = res.authors?.some(a => 
            a.toLowerCase().includes(cleanAuthor.toLowerCase()) || 
            cleanAuthor.toLowerCase().includes(a.toLowerCase())
        ) || false;
        if (titleMatch && authorMatch) {
            console.log(`Match phase 1: ${res.label} by ${res.authors} (${res.uri})`);
            return res.uri;
        }
    }

    // 2. Author match only
    for (const res of results) {
        const authorMatch = res.authors?.some(a => 
            a.toLowerCase().includes(cleanAuthor.toLowerCase()) || 
            cleanAuthor.toLowerCase().includes(a.toLowerCase())
        ) || false;
        const normResTitle = normalizeTitle(res.label);
        const titleIncluded = normResTitle.includes(normTitleQuery) || 
                              normTitleQuery.includes(normResTitle);
        
        if (authorMatch && titleIncluded) {
            console.log(`Match phase 2: ${res.label} by ${res.authors} (${res.uri})`);
            return res.uri;
        }
    }
    return null;
};

async function main() {
    const res = await findWorkUriByTitleAndAuthor("L'histoire de France", "Jules Michelet");
    console.log("Final URI matched:", res);
}
main();
