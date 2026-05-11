export const INVENTAIRE_BASE = 'https://inventaire.io';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InventaireEntity {
    id?: string;
    uri?: string;
    type?: string;
    label?: string;
    labels?: Record<string, string>;
    descriptions?: Record<string, string>;
    claims?: Record<string, string[]>;
    sitelinks?: Record<string, { title: string; url: string }>;
    image?: string | { url?: string; file?: string };
}

export interface InventaireSearchResult {
    id: string;
    uri: string;
    type: string;
    label: string;
    image?: string | null;
    authors?: string[];
    authorUris?: string[];
}

export interface InventaireEdition {
    inventaireUri: string;
    isbn: string | null;
    title: string | null;
    publishDate: string | null;
    publisherUri: string | null;
    languageUri: string | null;
    cover: string | null;
    pages: number | null;
}

export interface InventaireWorkDetails {
    uri: string;
    title: string | null;
    image: string | null;
    authorUris: string[];
    year: number | null;
    genreUris: string[];
    wikipediaTitle: string | null;
    pages: number | null;
}

export interface InventaireAuthorDetails {
    uri: string;
    name: string | null;
    image: string | null;
    birthDate: string | null;
    nationality: string | null;
    wikipediaTitle: string | null;
    description: string | null;
}

// ─── HTTP Client ─────────────────────────────────────────────────────────────

const USER_AGENT = 'QuotexApp/1.0 (chantreau@example.com)'; // Replace with actual email later if needed

export const fetchWithAgent = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = {
        'User-Agent': USER_AGENT,
        ...(options.headers || {})
    };
    return fetch(url, { ...options, headers });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const resolveImageUrl = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('/img/')) return `${INVENTAIRE_BASE}${raw}`;
    return null;
};

export const isNativeScan = (url: string | null | undefined): boolean => {
    return !!(url && url.includes('/img/entities/'));
};

export const getEntityImage = (imageObj: InventaireEntity['image']): string | null => {
    if (!imageObj) return null;
    if (typeof imageObj === 'string') return resolveImageUrl(imageObj);
    if (imageObj.file && imageObj.file.startsWith('/img/')) {
        return resolveImageUrl(imageObj.file);
    }
    return resolveImageUrl(imageObj.url);
};

export const safeFirstClaim = (claims: InventaireEntity['claims'], property: string): string | null => {
    return claims?.[property]?.[0] ?? null;
};

export const formatInventaireDate = (rawDate: string | null): string | null => {
    if (!rawDate) return null;
    let cleanDate = rawDate.startsWith('+') ? rawDate.substring(1) : rawDate;
    if (cleanDate.includes('-00-00')) {
        return cleanDate.split('-')[0];
    }
    try {
        const date = new Date(cleanDate);
        if (isNaN(date.getTime())) return rawDate;
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return rawDate;
    }
};

export const formatInventaireWork = (entity: InventaireEntity, uri?: string): Partial<InventaireWorkDetails> & { label?: string, authors?: string[] } => {
    if (!entity) return {};
    const claims = entity.claims || {};
    const labels = entity.labels || {};
    
    const label = labels['fr'] || labels['en'] || entity.label || Object.values(labels)[0] || null;
    const publishDateRaw = safeFirstClaim(claims, 'wdt:P577');
    const year = publishDateRaw ? parseInt(publishDateRaw.substring(0, 4)) : null;
    
    // Try wdt:P18 for image if top-level image is missing
    let imageUrl = getEntityImage(entity.image);
    if (!imageUrl) {
        const p18 = safeFirstClaim(claims, 'wdt:P18');
        if (p18) imageUrl = resolveImageUrl(p18);
    }
    
    const sitelinks = entity.sitelinks || {};
    const pagesClaim = safeFirstClaim(claims, 'wdt:P1104');

    return {
        uri: entity.uri || uri,
        title: label as string | null,
        year,
        image: imageUrl,
        authorUris: claims['wdt:P50'] || [],
        genreUris: claims['wdt:P136'] || [],
        wikipediaTitle: sitelinks['frwiki']?.title || sitelinks['enwiki']?.title || null,
        pages: pagesClaim ? parseInt(pagesClaim) : null,
        label: label as string
    };
};

// ─── API: Search ─────────────────────────────────────────────────────────────

export const searchInventaire = async (query: string, types: string = 'works', limit = 10): Promise<InventaireSearchResult[]> => {
    if (!query.trim()) return [];
    console.log(`[Inventaire API] Searching for "${query}" (types: ${types})`);
    try {
        const typesList = types.split(',');
        const typesParam = typesList.map(t => `types=${encodeURIComponent(t.trim())}`).join('&');
        const url = `${INVENTAIRE_BASE}/api/search?${typesParam}&search=${encodeURIComponent(query)}&limit=${limit}&lang=fr`;
        const response = await fetchWithAgent(url);
        if (!response.ok) throw new Error(`Inventaire search error: ${response.status}`);
        const data = await response.json();

        const basicResults: InventaireSearchResult[] = (data.results || []).map((r: any) => ({
            id: r.id,
            uri: r.uri,
            type: r.type,
            label: r.label || '',
            image: resolveImageUrl(r.image),
            authors: []
        }));

        if (basicResults.length === 0) return [];

        const urisToFetch = basicResults.map(r => r.uri);
        const entities = await getInventaireEntities(urisToFetch);

        const authorUrisToFetch = new Set<string>();
        for (const uri of urisToFetch) {
            const entity = entities[uri];
            if (entity?.claims?.['wdt:P50']) {
                entity.claims['wdt:P50'].forEach(aUri => authorUrisToFetch.add(aUri));
            }
        }

        const authorNamesByUri: Record<string, string> = {};
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
                const label = labels['fr'] || labels['en'] || entity.label || Object.values(labels)[0] || result.label;
                result.label = label;
                result.image = getEntityImage(entity.image) || result.image;

                if (claims['wdt:P50'] && claims['wdt:P50'].length > 0) {
                    result.authors = claims['wdt:P50'].map((aUri: string) => authorNamesByUri[aUri] || 'Unknown');
                    result.authorUris = claims['wdt:P50'];
                }
            }
        }
        // Sort results: prefer 'wd:' over others if labels are similar, or by score
        const sortedResults = basicResults.sort((a, b) => {
            const aIsWd = a.uri.startsWith('wd:');
            const bIsWd = b.uri.startsWith('wd:');
            if (aIsWd && !bIsWd) return -1;
            if (!aIsWd && bIsWd) return 1;
            return 0; // Keep original relative order (by score) for same type
        });

        return sortedResults;
    } catch (e) {
        console.error('[Inventaire API] Error searching:', e);
        return [];
    }
};

export const searchInventaireWorks = async (query: string, limit = 10): Promise<InventaireSearchResult[]> => {
    return searchInventaire(query, 'works,genres,movements', limit);
};

export const searchInventaireAuthors = async (query: string, limit = 10): Promise<InventaireSearchResult[]> => {
    return searchInventaire(query, 'humans', limit);
};

export const findWorkUriByTitleAndAuthor = async (title: string, authorName: string): Promise<string | null> => {
    if (!title || !authorName) return null;
    const cleanTitle = title.trim();
    const cleanAuthor = authorName.trim();
    
    // Try first with title only to get broader results, then filter
    const results = await searchInventaireWorks(cleanTitle, 30);

    if (results.length === 0) return null;

    // 1. Precise match (Title + Author)
    for (const res of results) {
        const titleMatch = res.label.toLowerCase().trim() === cleanTitle.toLowerCase();
        const authorMatch = res.authors?.some(a => 
            a.toLowerCase().includes(cleanAuthor.toLowerCase()) || 
            cleanAuthor.toLowerCase().includes(a.toLowerCase())
        ) || false;
        if (titleMatch && authorMatch) return res.uri;
    }

    // 2. Author match only (if title was slightly different but author is sure)
    for (const res of results) {
        const authorMatch = res.authors?.some(a => 
            a.toLowerCase().includes(cleanAuthor.toLowerCase()) || 
            cleanAuthor.toLowerCase().includes(a.toLowerCase())
        ) || false;
        const titleIncluded = res.label.toLowerCase().includes(cleanTitle.toLowerCase()) || 
                             cleanTitle.toLowerCase().includes(res.label.toLowerCase());
        
        if (authorMatch && titleIncluded) return res.uri;
    }
    
    return null;
};

// ─── API: Entities ───────────────────────────────────────────────────────────

export const getInventaireEntities = async (uris: string[]): Promise<Record<string, InventaireEntity>> => {
    if (!uris.length) return {};
    try {
        const uriParam = uris.join('|');
        const url = `${INVENTAIRE_BASE}/api/entities/by-uris?uris=${encodeURIComponent(uriParam)}&lang=fr&props=labels|descriptions|claims|sitelinks|image`;
        const response = await fetchWithAgent(url);
        if (!response.ok) throw new Error(`Inventaire entities error: ${response.status}`);
        const data = await response.json();
        return data.entities || {};
    } catch (e) {
        console.error('[Inventaire API] Error fetching entities:', e);
        return {};
    }
};

export const getBatchInventaireSearchMetadata = async (uris: string[]): Promise<Record<string, { image: string | null, label: string | null }>> => {
    if (!uris.length) return {};
    const ids = uris.map(uri => {
        if (uri.startsWith('wd:')) return uri.substring(3);
        if (uri.startsWith('inv:')) return uri.substring(4);
        return null;
    }).filter(Boolean);

    if (ids.length === 0) return {};
    const results: Record<string, { image: string | null, label: string | null }> = {};
    const CHUNK_SIZE = 10;

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const searchQuery = chunk.map(id => `id:"${id}"`).join(' OR ');
        try {
            const url = `${INVENTAIRE_BASE}/api/search?types=works&search=${encodeURIComponent(searchQuery)}&limit=${chunk.length}&lang=fr`;
            const response = await fetchWithAgent(url);
            if (!response.ok) continue;
            const data = await response.json();
            (data.results || []).forEach((r: any) => {
                if (r.uri) {
                    results[r.uri] = { image: resolveImageUrl(r.image), label: r.label || null };
                }
            });
        } catch (e) {
            console.error('[Inventaire API] Error in batch search metadata:', e);
        }
    }
    return results;
};

export const getInventaireWorkDetails = async (uri: string): Promise<InventaireWorkDetails | null> => {
    const entities = await getInventaireEntities([uri]);
    const entity = entities[uri];
    if (!entity) return null;
    const formatted = formatInventaireWork(entity, uri);
    return {
        uri: formatted.uri!,
        title: formatted.title || null,
        image: formatted.image || null,
        authorUris: formatted.authorUris || [],
        year: formatted.year || null,
        genreUris: formatted.genreUris || [],
        wikipediaTitle: formatted.wikipediaTitle || null,
        pages: formatted.pages || null,
    };
};

export const getInventaireAuthorDetails = async (uri: string): Promise<InventaireAuthorDetails | null> => {
    const entities = await getInventaireEntities([uri]);
    const entity = entities[uri];
    if (!entity) return null;

    const claims = entity.claims || {};
    const labels = entity.labels || {};
    const name = labels['fr'] || labels['en'] || Object.values(labels)[0] || null;
    const birthDate = formatInventaireDate(safeFirstClaim(claims, 'wdt:P569'));
    const nationalityUri = safeFirstClaim(claims, 'wdt:P27');
    
    let imageUrl = getEntityImage(entity.image);
    if (!imageUrl) {
        const p18 = safeFirstClaim(claims, 'wdt:P18');
        if (p18) imageUrl = resolveImageUrl(p18);
    }

    const sitelinks = entity.sitelinks || {};
    const wikipediaTitle = sitelinks['frwiki']?.title || sitelinks['enwiki']?.title || null;
    const descriptions = entity.descriptions || {};
    const description = descriptions['fr'] || descriptions['en'] || Object.values(descriptions)[0] || null;

    return { uri, name, image: imageUrl, birthDate, nationality: nationalityUri, wikipediaTitle, description };
};

export const fetchWikipediaSynopsis = async (title: string, lang: string = 'fr'): Promise<string | null> => {
    if (!title) return null;
    try {
        console.log(`[Wikipedia API] Fetching synopsis for: ${title} (${lang})`);
        const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=4&explaintext=1&exintro=1&titles=${encodeURIComponent(title)}&format=json`;
        const response = await fetchWithAgent(url);
        if (!response.ok) return null;
        const data = await response.json();
        const pages = data.query?.pages;
        if (!pages) return null;
        const firstPageId = Object.keys(pages)[0];
        if (firstPageId === '-1') return null;
        const extract = pages[firstPageId]?.extract;
        if (!extract || extract.trim().length === 0) return null;
        return extract.trim();
    } catch (e) {
        console.error('[Wikipedia API] Error fetching synopsis:', e);
        return null;
    }
};

export const getBatchInventaireDetails = async (uris: string[]): Promise<Record<string, Partial<InventaireWorkDetails>>> => {
    if (!uris.length) return {};
    const entities = await getInventaireEntities(uris);
    const results: Record<string, Partial<InventaireWorkDetails>> = {};
    for (const [uri, entity] of Object.entries(entities)) {
        if (!entity) continue;
        results[uri] = formatInventaireWork(entity, uri);
    }
    return results;
};

// ─── API: Editions ───────────────────────────────────────────────────────────

export const getWorkEditionUris = async (workUri: string): Promise<string[]> => {
    try {
        const url = `${INVENTAIRE_BASE}/api/entities?action=reverse-claims&property=wdt:P629&value=${encodeURIComponent(workUri)}`;
        const response = await fetchWithAgent(url);
        if (!response.ok) throw new Error(`Inventaire reverse-claims error: ${response.status}`);
        const data = await response.json();
        return data.uris || [];
    } catch (e) {
        console.error('[Inventaire API] Error fetching edition URIs:', e);
        return [];
    }
};

export const getAuthorWorkUris = async (authorUri: string): Promise<string[]> => {
    try {
        const url = `${INVENTAIRE_BASE}/api/entities?action=reverse-claims&property=wdt:P50&value=${encodeURIComponent(authorUri)}`;
        const response = await fetchWithAgent(url);
        if (!response.ok) throw new Error(`Inventaire reverse-claims error: ${response.status}`);
        const data = await response.json();
        return data.uris || [];
    } catch (e) {
        console.error('[Inventaire API] Error fetching author work URIs:', e);
        return [];
    }
};

export const getEditionsDetails = async (editionUris: string[]): Promise<InventaireEdition[]> => {
    const results: InventaireEdition[] = [];
    const CHUNK_SIZE = 15;
    const chunkPromises = [];

    for (let i = 0; i < editionUris.length; i += CHUNK_SIZE) {
        const chunk = editionUris.slice(i, i + CHUNK_SIZE);
        chunkPromises.push(getInventaireEntities(chunk));
    }

    const chunkResults = await Promise.all(chunkPromises);

    for (const entities of chunkResults) {
        for (const [uri, e] of Object.entries(entities)) {
            const claims = e.claims || {};
            const labels = e.labels || {};
            const isbn = safeFirstClaim(claims, 'wdt:P212');
            const title = safeFirstClaim(claims, 'wdt:P1476') || labels['fr'] || labels['en'] || (labels as any)['fromclaims'] || null;
            const publishDate = safeFirstClaim(claims, 'wdt:P577');
            const publisherUri = safeFirstClaim(claims, 'wdt:P123');
            const languageUri = safeFirstClaim(claims, 'wdt:P407');
            const pagesRaw = safeFirstClaim(claims, 'wdt:P1104');
            const cover = getEntityImage(e.image);
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
};

export const getWorkEditions = async (workUri: string): Promise<InventaireEdition[]> => {
    const uris = await getWorkEditionUris(workUri);
    if (!uris.length) return [];
    return getEditionsDetails(uris.slice(0, 30));
};

export const getBestNativeCovers = async (workUris: string[]): Promise<Record<string, string | null>> => {
    if (!workUris.length) return {};
    const results: Record<string, string | null> = {};
    try {
        const editionUrisPerWork = await Promise.all(
            workUris.map(async (uri) => {
                const edUris = await getWorkEditionUris(uri);
                return { workUri: uri, edUris };
            })
        );
        
        const allEdUris = editionUrisPerWork.flatMap(x => x.edUris.slice(0, 5)); // Reduced limit
        if (allEdUris.length === 0) return results;
        
        const allEdDetails = await getEditionsDetails(allEdUris);
        const searchMetadata = await getBatchInventaireSearchMetadata(workUris);

        for (const { workUri, edUris } of editionUrisPerWork) {
            const searchImg = searchMetadata[workUri]?.image;
            if (isNativeScan(searchImg)) {
                results[workUri] = searchImg;
                continue;
            }
            const eds = allEdDetails.filter(d => edUris.includes(d.inventaireUri));
            if (eds.length === 0) continue;
            
            const bestEd = eds.sort((a, b) => {
                let scoreA = 0, scoreB = 0;
                if (a.languageUri === 'wd:Q150') scoreA += 10;
                if (a.cover?.includes('/img/entities/')) scoreA += 5;
                if (a.isbn) scoreA += 2;
                if ((a.pages || 0) > 0) scoreA += 1;
                
                if (b.languageUri === 'wd:Q150') scoreB += 10;
                if (b.cover?.includes('/img/entities/')) scoreB += 5;
                if (b.isbn) scoreB += 2;
                if ((b.pages || 0) > 0) scoreB += 1;
                
                return scoreB - scoreA;
            })[0];
            
            if (bestEd?.cover) results[workUri] = bestEd.cover;
        }
    } catch (err) {
        console.error(`[Inventaire API] Error in getBestNativeCovers:`, err);
    }
    return results;
};
