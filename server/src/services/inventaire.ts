const INVENTAIRE_BASE = 'https://inventaire.io';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InventaireSearchResult {
    id: string;
    uri: string;         // ex. "wd:Q34670" or "inv:abc123"
    type: string;        // "works" | "humans"
    label: string;
    description?: string;
    image?: string;      // Full URL, resolved from /img/entities/<hash>
    authors?: string[];  // Author names natively attached
}

export interface InventaireEdition {
    inventaireUri: string;   // ex. "isbn:9782070364770"
    isbn: string | null;
    title: string | null;
    publishDate: string | null;
    publisherUri: string | null;
    languageUri: string | null;
    cover: string | null;    // Full https://inventaire.io/img/entities/... URL
    pages: number | null;    // Number of pages (wdt:P1104)
}

export interface InventaireWorkDetails {
    uri: string;
    title: string | null;
    description: string | null;
    image: string | null;
    authorUris: string[];
    year: number | null;
    genreUris: string[];
    wikipediaTitle: string | null;
}

export interface InventaireAuthorDetails {
    uri: string;
    name: string | null;
    image: string | null;
    birthDate: string | null;
    nationality: string | null;
    wikipediaTitle: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveImageUrl = (raw: string | undefined): string | null => {
    if (!raw) return null;
    if (raw.startsWith('http')) return raw;
    // Format: "/img/entities/<hash>" → prepend base
    if (raw.startsWith('/img/')) return `${INVENTAIRE_BASE}${raw}`;
    // Format returned by entity detail: it's already a full Wikimedia URL via image.url
    return null;
};

const safeFirstClaim = (claims: Record<string, any[]>, property: string): string | null => {
    return claims?.[property]?.[0] ?? null;
};

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Search for books (works) on Inventaire.io
 */
export const searchInventaireWorks = async (
    query: string,
    limit = 10
): Promise<InventaireSearchResult[]> => {
    if (!query.trim()) return [];
    try {
        const url = `${INVENTAIRE_BASE}/api/search?types=works&search=${encodeURIComponent(query)}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Inventaire search error: ${response.status}`);
        const data = await response.json();
        
        const basicResults = (data.results || []).map((r: any) => ({
            id: r.id,
            uri: r.uri,
            type: 'works',
            label: r.label || '',
            description: r.description || '',
            image: resolveImageUrl(r.image),
            authors: []
        }));

        if (basicResults.length === 0) return [];

        // 1. Fetch work entities to get Author URIs (wdt:P50)
        const workUris = basicResults.map((r: any) => r.uri);
        const workEntities = await getInventaireEntities(workUris);

        const authorUrisToFetch = new Set<string>();
        for (const uri of workUris) {
            const entity = workEntities[uri];
            if (entity && entity.claims && entity.claims['wdt:P50']) {
                entity.claims['wdt:P50'].forEach((aUri: string) => authorUrisToFetch.add(aUri));
            }
        }

        // 2. Fetch author entities to get names
        const authorNamesByUri: Record<string, string> = {};
        if (authorUrisToFetch.size > 0) {
            const authorEntities = await getInventaireEntities(Array.from(authorUrisToFetch));
            for (const [aUri, aEntity] of Object.entries(authorEntities)) {
                if (aEntity && (aEntity as any).labels) {
                    const labels = (aEntity as any).labels;
                    authorNamesByUri[aUri] = labels['fr'] || labels['en'] || Object.values(labels)[0] || 'Unknown';
                }
            }
        }

        // 3. Attach authors to results
        for (const result of basicResults) {
            const entity = workEntities[result.uri];
            if (entity && entity.claims && entity.claims['wdt:P50']) {
                result.authors = entity.claims['wdt:P50'].map((aUri: string) => authorNamesByUri[aUri] || 'Unknown');
            }
        }

        return basicResults;
    } catch (e) {
        console.error('[Inventaire] Error searching works:', e);
        return [];
    }
};

/**
 * Search for authors (humans) on Inventaire.io
 */
export const searchInventaireAuthors = async (
    query: string,
    limit = 10
): Promise<InventaireSearchResult[]> => {
    if (!query.trim()) return [];
    try {
        const url = `${INVENTAIRE_BASE}/api/search?types=humans&search=${encodeURIComponent(query)}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Inventaire search error: ${response.status}`);
        const data = await response.json();
        return (data.results || []).map((r: any) => ({
            id: r.id,
            uri: r.uri,
            type: 'humans',
            label: r.label || '',
            description: r.description || '',
            // Author images in search results are plain filenames (Wikimedia), we can't use them here without resolving
            image: r.image && r.image.startsWith('/img/') ? resolveImageUrl(r.image) : null,
        }));
    } catch (e) {
        console.error('[Inventaire] Error searching humans:', e);
        return [];
    }
};

// ─── Entity Details ───────────────────────────────────────────────────────────

/**
 * Get details for one or several entities by URI.
 * Returns the raw parsed entities map.
 */
export const getInventaireEntities = async (
    uris: string[]
): Promise<Record<string, any>> => {
    if (!uris.length) return {};
    try {
        // API accepts: ?action=by-uris&uris=uri1|uri2|...
        const uriParam = uris.join('|');
        const url = `${INVENTAIRE_BASE}/api/entities?action=by-uris&uris=${encodeURIComponent(uriParam)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Inventaire entities error: ${response.status}`);
        const data = await response.json();
        return data.entities || {};
    } catch (e) {
        console.error('[Inventaire] Error fetching entities:', e);
        return {};
    }
};

/**
 * Get work details from a URI
 */
export const getInventaireWorkDetails = async (uri: string): Promise<InventaireWorkDetails | null> => {
    const entities = await getInventaireEntities([uri]);
    const entity = entities[uri];
    if (!entity) return null;

    const claims = entity.claims || {};
    const labels = entity.labels || {};

    const label = labels['fr'] || labels['en'] || Object.values(labels)[0] || null;
    const publishDateRaw = safeFirstClaim(claims, 'wdt:P577');
    const year = publishDateRaw ? parseInt(publishDateRaw.substring(0, 4)) : null;
    const imageUrl = entity.image?.url ?? resolveImageUrl(entity.image?.file);

    // Extract Wikipedia title if available
    const sitelinks = entity.sitelinks || {};
    const wikipediaTitle = sitelinks['frwiki']?.title || sitelinks['enwiki']?.title || null;

    return {
        uri,
        title: label as string | null,
        description: null, // Works usually don't have descriptions on Inventaire
        image: imageUrl || null,
        authorUris: claims['wdt:P50'] || [],
        year,
        genreUris: claims['wdt:P136'] || [],
        wikipediaTitle,
    };
};

/**
 * Fetch a short synopsis from Wikipedia using the exact page title
 */
export const fetchWikipediaSynopsis = async (title: string, lang: string = 'fr'): Promise<string | null> => {
    if (!title) return null;
    try {
        const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=4&explaintext=1&exintro=1&titles=${encodeURIComponent(title)}&format=json`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        const pages = data.query?.pages;
        if (!pages) return null;
        const firstPageId = Object.keys(pages)[0];
        if (firstPageId === '-1') return null;
        
        const extract = pages[firstPageId]?.extract;
        return extract && extract.trim().length > 0 ? extract.trim() : null;
    } catch (e) {
        console.error('[Wikipedia] Error fetching synopsis:', e);
        return null;
    }
};

/**
 * Get author details from a URI
 */
export const getInventaireAuthorDetails = async (uri: string): Promise<InventaireAuthorDetails | null> => {
    const entities = await getInventaireEntities([uri]);
    const entity = entities[uri];
    if (!entity) return null;

    const claims = entity.claims || {};
    const labels = entity.labels || {};
    const descriptions = entity.descriptions || {};

    const name = labels['fr'] || labels['en'] || Object.values(labels)[0] || null;
    const birthDate = safeFirstClaim(claims, 'wdt:P569');
    const nationalityUri = safeFirstClaim(claims, 'wdt:P27');

    let imageUrl: string | null = null;
    if (entity.image?.url) {
        imageUrl = entity.image.url;
    } else if (entity.image?.file) {
        // Wikimedia image file name — build a URL
        const encoded = encodeURIComponent(entity.image.file.replace(/ /g, '_'));
        imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=300`;
    }

    const sitelinks = entity.sitelinks || {};
    const wikipediaTitle = sitelinks['frwiki']?.title || sitelinks['enwiki']?.title || null;

    return {
        uri,
        name: name as string | null,
        image: imageUrl,
        birthDate,
        nationality: nationalityUri,
        wikipediaTitle,
    };
};

// ─── Editions ─────────────────────────────────────────────────────────────────

/**
 * Get all edition URIs for a given work URI
 */
export const getWorkEditionUris = async (workUri: string): Promise<string[]> => {
    try {
        const url = `${INVENTAIRE_BASE}/api/entities?action=reverse-claims&property=wdt:P629&value=${encodeURIComponent(workUri)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Inventaire reverse-claims error: ${response.status}`);
        const data = await response.json();
        return data.uris || [];
    } catch (e) {
        console.error('[Inventaire] Error fetching edition URIs:', e);
        return [];
    }
};

/**
 * Fetch details for a batch of edition URIs.
 * We chunk to avoid URL being too long (API limit).
 */
export const getEditionsDetails = async (editionUris: string[]): Promise<InventaireEdition[]> => {
    const results: InventaireEdition[] = [];
    const CHUNK_SIZE = 15;

    for (let i = 0; i < editionUris.length; i += CHUNK_SIZE) {
        const chunk = editionUris.slice(i, i + CHUNK_SIZE);
        const entities = await getInventaireEntities(chunk);

        for (const [uri, e] of Object.entries(entities)) {
            const claims = (e as any).claims || {};
            const labels = (e as any).labels || {};

            const isbn = safeFirstClaim(claims, 'wdt:P212');
            const title = safeFirstClaim(claims, 'wdt:P1476') ||
                labels['fr'] || labels['en'] || labels['fromclaims'] || null;
            const publishDate = safeFirstClaim(claims, 'wdt:P577');
            const publisherUri = safeFirstClaim(claims, 'wdt:P123');
            const languageUri = safeFirstClaim(claims, 'wdt:P407');
            const pagesRaw = safeFirstClaim(claims, 'wdt:P1104');

            // Cover: entity.image can be { url } or path like /img/entities/<hash>
            let cover: string | null = null;
            if ((e as any).image?.url) {
                const imgUrl = (e as any).image.url;
                cover = imgUrl.startsWith('/img/') ? `${INVENTAIRE_BASE}${imgUrl}` : imgUrl;
            } else if ((e as any).image?.file) {
                const path = (e as any).image.file;
                cover = path.startsWith('/img/') ? `${INVENTAIRE_BASE}${path}` : path;
            }

            // Parsing pages if present
            const pages = pagesRaw ? parseInt(pagesRaw) : null;

            results.push({
                inventaireUri: uri,
                isbn,
                title,
                publishDate: publishDate ? publishDate.substring(0, 4) : null,
                publisherUri,
                languageUri,
                cover,
                pages,
            });
        }
    }

    return results;
};

/**
 * High-level: get all editions for a work, with details.
 * Limits to the first 30 editions to keep it manageable.
 */
export const getWorkEditions = async (workUri: string): Promise<InventaireEdition[]> => {
    const uris = await getWorkEditionUris(workUri);
    if (!uris.length) return [];
    const limited = uris.slice(0, 30);
    return getEditionsDetails(limited);
};
