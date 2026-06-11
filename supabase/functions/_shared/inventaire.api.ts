export const INVENTAIRE_BASE = 'https://inventaire.io';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ─── Cache Global ────────────────────────────────────────────────────────────
const entityCache = new Map<string, Promise<Record<string, InventaireEntity>>>();
const wikipediaCache = new Map<string, Promise<string | null>>();
const searchCache = new Map<string, Promise<InventaireSearchResult[]>>();

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
    description: string | null;
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

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const InventaireSearchResultSchema = z.object({
  id: z.string(),
  uri: z.string(),
  type: z.string(),
  label: z.string().optional(),
  image: z.string().nullable().optional()
});

const InventaireSearchResponseSchema = z.object({
  results: z.array(InventaireSearchResultSchema).optional().default([])
});

// ─── HTTP Client ─────────────────────────────────────────────────────────────

const USER_AGENT = 'QuotexApp/1.0 (chantreau@example.com)'; // Replace with actual email later if needed

export const fetchWithAgent = async (url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> => {
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
    return cleanDate.split('T')[0];
};

export const formatInventaireWork = (entity: InventaireEntity, uri?: string): Partial<InventaireWorkDetails> & { label?: string, authors?: string[] } => {
    if (!entity) return {};
    const claims = entity.claims || {};
    const labels = entity.labels || {};
    const descriptions = entity.descriptions || {};
    
    // Get label with preference: fr > en > entity.label > first available
    // Normalize case for French titles to ensure consistent capitalization
    let label = labels['fr'] || labels['en'] || entity.label || Object.values(labels)[0] || null;
    if (label && label.length > 0) {
        // For French, ensure proper title case for known article starts
        // This handles cases where Inventaire might return lowercase titles
        const frLabel = labels['fr'];
        if (frLabel && frLabel.toLowerCase().startsWith('le ') && !frLabel.startsWith('Le ')) {
            label = 'Le ' + capitalizeFirstLetter(frLabel.substring(3));
        } else if (frLabel && frLabel.toLowerCase().startsWith('la ') && !frLabel.startsWith('La ')) {
            label = 'La ' + capitalizeFirstLetter(frLabel.substring(3));
        } else if (frLabel && frLabel.toLowerCase().startsWith('les ') && !frLabel.startsWith('Les ')) {
            label = 'Les ' + capitalizeFirstLetter(frLabel.substring(4));
        } else if (frLabel && frLabel.toLowerCase().startsWith('l\'') && !frLabel.startsWith('L\'')) {
            label = 'L\'' + capitalizeFirstLetter(frLabel.substring(2));
        } else if (frLabel && !frLabel.startsWith(frLabel.charAt(0).toUpperCase())) {
            // If the label doesn't start with uppercase, capitalize the first letter
            label = frLabel.charAt(0).toUpperCase() + frLabel.slice(1);
        }
    }
    const description = descriptions['fr'] || descriptions['en'] || Object.values(descriptions)[0] || null;
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
        description: description as string | null,
        year,
        image: imageUrl,
        authorUris: claims['wdt:P50'] || [],
        genreUris: Array.from(new Set([...(claims['wdt:P136'] || []), ...(claims['wdt:P7937'] || [])])),
        wikipediaTitle: sitelinks['frwiki']?.title || sitelinks['enwiki']?.title || null,
        pages: pagesClaim ? parseInt(pagesClaim) : null,
        label: label as string
    };
};

// ─── API: Search ─────────────────────────────────────────────────────────────

export const searchInventaire = async (query: string, types: string = 'works', limit = 10): Promise<InventaireSearchResult[]> => {
    if (!query.trim()) return [];
    
    const cacheKey = `${query}:${types}:${limit}`;
    
    // Return cached promise if exists
    if (searchCache.has(cacheKey)) {
        return searchCache.get(cacheKey)!;
    }
    
    const fetchPromise = (async () => {
        console.log(`[Inventaire API] Searching for "${query}" (types: ${types})`);
        try {
            const typesList = types.split(',');
            const typesParam = typesList.map(t => `types=${encodeURIComponent(t.trim())}`).join('&');
            const url = `${INVENTAIRE_BASE}/api/search?${typesParam}&search=${encodeURIComponent(query)}&limit=${limit}&lang=fr`;
            const response = await fetchWithAgent(url);
            if (!response.ok) {
                console.error(`[Inventaire API] Search HTTP error: ${response.status} for query "${query}"`);
                throw new Error(`Inventaire search error: ${response.status}`);
            }
            const rawData = await response.json();
            
            // Validate response with Zod
            const validated = InventaireSearchResponseSchema.safeParse(rawData);
            if (!validated.success) {
                console.error('[Inventaire API] Invalid search response format:', validated.error);
                throw new Error('Inventaire API returned unexpected format');
            }
            const data = validated.data;

            const basicResults: InventaireSearchResult[] = data.results.map((r: any) => ({
            id: r.id,
            uri: r.uri,
            type: r.type,
            label: r.label || '',
            image: resolveImageUrl(r.image),
            authors: []
        }));

        if (basicResults.length === 0) {
            console.log(`[Inventaire API] No results found for "${query}"`);
            return [];
        }

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
    })();
    
    searchCache.set(cacheKey, fetchPromise);
    // Clean cache after 5 minutes
    setTimeout(() => searchCache.delete(cacheKey), 300000);
    
    return fetchPromise;
};

export const searchInventaireWorks = async (query: string, limit = 10): Promise<InventaireSearchResult[]> => {
    return searchInventaire(query, 'works,genres,movements', limit);
};

export interface InventaireBookByIsbnResult {
    inventaireUri: string;
    title: string;
    authors: string[];
    authorUris: string[];
    description: string;
    year: number | null;
    pages: number | null;
    cover: string | null;
    isbn: string;
    label: string;
    uri: string;
    image: string | null;
}

export const getInventaireBookByIsbn = async (isbn: string): Promise<InventaireBookByIsbnResult | null> => {
    try {
        console.log(`[Inventaire API] Fetching by ISBN: ${isbn}`);
        const url = `${INVENTAIRE_BASE}/api/entities/by-uris?uris=isbn:${isbn}&lang=fr&props=labels|descriptions|claims|sitelinks|image`;
        const response = await fetchWithAgent(url);
        if (!response.ok) {
            console.error(`[Inventaire API] ISBN HTTP error: ${response.status} for ISBN ${isbn}`);
            return null;
        }
        const data = await response.json();
        const entities = data.entities || {};
        const entityKeys = Object.keys(entities);
        if (entityKeys.length === 0) {
            console.log(`[Inventaire API] No entity found for ISBN ${isbn}`);
            return null;
        }

        const editionUri = entityKeys[0];
        const edition = entities[editionUri];
        const claims = edition.claims || {};
        const labels = edition.labels || {};

        const editionTitle = claims['wdt:P1476']?.[0] || labels['fromclaims'] || labels['fr'] || labels['en'] || Object.values(labels)[0] || 'Livre inconnu';
        const editionYear = claims['wdt:P577']?.[0] ? parseInt(claims['wdt:P577'][0].substring(0, 4)) : null;
        const editionPages = claims['wdt:P1104']?.[0] ? parseInt(claims['wdt:P1104'][0]) : null;
        
        let editionCover = getEntityImage(edition.image);
        if (!editionCover) {
            const p18 = safeFirstClaim(claims, 'wdt:P18');
            if (p18) editionCover = resolveImageUrl(p18);
        }

        const workUri = safeFirstClaim(claims, 'wdt:P629');

        let title = editionTitle;
        let description = '';
        let year = editionYear;
        let pages = editionPages;
        let cover = editionCover;
        let authorUris: string[] = [];
        let authorNames: string[] = [];

        if (workUri) {
            console.log(`[Inventaire API] Found Work URI: ${workUri} for ISBN. Fetching work details.`);
            try {
                const workDetails = await getInventaireWorkDetails(workUri);
                if (workDetails) {
                    title = workDetails.title || title;
                    description = workDetails.description || '';
                    year = workDetails.year || year;
                    pages = workDetails.pages || pages;
                    cover = workDetails.image || cover;
                    authorUris = workDetails.authorUris || [];

                    if (authorUris.length > 0) {
                        try {
                            const authorEntities = await getInventaireEntities(authorUris);
                            authorNames = authorUris.map(uri => {
                                const aEnt = authorEntities[uri];
                                if (aEnt?.labels) {
                                    return aEnt.labels['fr'] || aEnt.labels['en'] || Object.values(aEnt.labels)[0] || 'Unknown';
                                }
                                return 'Unknown';
                            }).filter(name => name !== 'Unknown');
                        } catch (authorErr) {
                            console.warn('[Inventaire API] Author fetch timed out, using edition data only.');
                        }
                    }
                }
            } catch (workErr) {
                console.warn('[Inventaire API] Work fetch timed out, using edition data only.');
            }
        }

        const finalUri = workUri || editionUri;

        return {
            inventaireUri: finalUri,
            title,
            authors: authorNames.length > 0 ? authorNames : ['Auteur inconnu'],
            authorUris,
            description,
            year,
            pages,
            cover,
            isbn,
            label: title,
            uri: finalUri,
            image: cover
        };
    } catch (e) {
        console.error('[Inventaire API] Error fetching book by ISBN:', e);
        return null;
    }
};

export const searchInventaireAuthors = async (query: string, limit = 10): Promise<InventaireSearchResult[]> => {
    return searchInventaire(query, 'humans', limit);
};

export const capitalizeFirstLetter = (str: string): string => {
    if (!str || str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const normalizeTitle = (t: string): string => {
    return t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[-']/g, "") // Remove hyphens and apostrophes
        .replace(/^(le\s+|la\s+|les\s+|l'|un\s+|une\s+|des\s+|du\s+|de\s+|d'|the\s+|a\s+|an\s+)/i, "") // Strip leading articles
        .replace(/[^a-z0-9]/g, "") // Remove punctuation/spaces
        .trim();
};

export const normalizeAuthorForComparison = (name: string): string => {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[-']/g, " ") // Replace hyphens and apostrophes with space
        .replace(/\s+/g, " ") // Collapse multiple spaces to single space
        .replace(/[^a-z0-9\s]/g, "") // Remove remaining punctuation
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "") // Remove zero-width and non-breaking spaces
        .trim();
};

export const compareAuthorNames = (name1: string, name2: string): boolean => {
    const n1 = normalizeAuthorForComparison(name1);
    const n2 = normalizeAuthorForComparison(name2);

    if (n1 === n2) return true;

    const words1 = n1.split(/\s+/).filter(w => w.length > 0);
    const words2 = n2.split(/\s+/).filter(w => w.length > 0);

    if (words1.length === 0 || words2.length === 0) return false;

    // Check if the main words (length > 1) are identical (handles middle initials)
    const mainWords1 = words1.filter(w => w.length > 1);
    const mainWords2 = words2.filter(w => w.length > 1);

    if (mainWords1.length > 0 && mainWords2.length > 0) {
        const joinedMain1 = mainWords1.join(' ');
        const joinedMain2 = mainWords2.join(' ');
        if (joinedMain1 === joinedMain2) {
            return true;
        }
    }

    // Check initials matching (e.g. "j.r.r. tolkien" vs "john ronald reuel tolkien")
    const lastWord1 = words1[words1.length - 1];
    const lastWord2 = words2[words2.length - 1];
    if (lastWord1 !== lastWord2) return false;

    const firstPart1 = words1.slice(0, -1);
    const firstPart2 = words2.slice(0, -1);

    if (firstPart1.length === 0 || firstPart2.length === 0) return false;

    const matchInitials = (seq1: string[], seq2: string[]): boolean => {
        if (seq1.length > seq2.length) return false;
        for (let i = 0; i < seq1.length; i++) {
            const w1 = seq1[i];
            const w2 = seq2[i];
            if (w1.length === 1) {
                if (w2[0] !== w1) return false;
            } else if (w2.length === 1) {
                if (w1[0] !== w2) return false;
            } else {
                if (w1 !== w2) return false;
            }
        }
        return true;
    };

    if (firstPart1.length <= firstPart2.length && matchInitials(firstPart1, firstPart2)) return true;
    if (firstPart2.length <= firstPart1.length && matchInitials(firstPart2, firstPart1)) return true;

    return false;
};

export const findWorkUriByTitleAndAuthor = async (title: string, authorName: string): Promise<string | null> => {
    if (!title || !authorName) {
        console.log(`[Inventaire Matching] Missing title or authorName. Title: "${title}", Author: "${authorName}"`);
        return null;
    }
    const cleanTitle = title.trim();
    const cleanAuthor = authorName.trim();
    console.log(`[Inventaire Matching] Querying Inventaire.io search for work: "${cleanTitle}"...`);
    
    // Try first with title only to get broader results, then filter
    // Also try with a normalized version of the title for better matching
    let results = await searchInventaireWorks(cleanTitle, 30);
    
    // If the title has special characters or case variations, also try normalized search
    const normalizedSearchTitle = cleanTitle
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-']/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    
    // Also try with title without leading articles for broader search
    const titleWithoutArticles = cleanTitle
        .replace(/^(le\s+|la\s+|les\s+|l'|un\s+|une\s+|des\s+|du\s+|de\s+|d'|the\s+|a\s+|an\s+)/i, "")
        .trim();
    
    // If the original search didn't find exact matches, try normalized variants
    // Compute normalized query once for matching
    const normTitleQuery = normalizeTitle(cleanTitle);
    const hasExactMatchInResults = results.some(res => normalizeTitle(res.label) === normTitleQuery);
    
    if (!hasExactMatchInResults && normalizedSearchTitle !== cleanTitle) {
        console.log(`[Inventaire Matching] Retrying search with normalized title: "${normalizedSearchTitle}"`);
        const normalizedResults = await searchInventaireWorks(normalizedSearchTitle, 30);
        if (normalizedResults.length > results.length) {
            results = normalizedResults;
        }
    }
    
    if (!hasExactMatchInResults && titleWithoutArticles !== cleanTitle && titleWithoutArticles.length > 0) {
        console.log(`[Inventaire Matching] Retrying search with title without articles: "${titleWithoutArticles}"`);
        const noArticleResults = await searchInventaireWorks(titleWithoutArticles, 30);
        if (noArticleResults.length > results.length) {
            results = noArticleResults;
        }
    }
    
    console.log(`[Inventaire Matching] Found ${results.length} search results for "${cleanTitle}"`);

    if (results.length === 0) {
        console.log(`[Inventaire Matching] No search results returned from Inventaire.io API for "${cleanTitle}"`);
        return null;
    }

    // 1. Precise match (Title + Author)
    console.log(`[Inventaire Matching] Step 1: Searching for precise match (normalized title query: "${normTitleQuery}", author query: "${cleanAuthor.toLowerCase()}")`);
    for (const res of results) {
        const normResTitle = normalizeTitle(res.label);
        const titleMatch = normResTitle === normTitleQuery;
        const authorMatch = res.authors?.some(a => 
            compareAuthorNames(a, cleanAuthor)
        ) || false;
        
        console.log(`[Inventaire Matching]   Checking result: "${res.label}" by [${res.authors?.join(', ') || 'unknown'}]. Title match: ${titleMatch}, Author match: ${authorMatch}`);
        if (titleMatch && authorMatch) {
            console.log(`[Inventaire Matching]   -> Precise match found! Selected URI: "${res.uri}"`);
            return res.uri;
        }
    }

    // 2. Author match only (if title was slightly different but author is sure)
    console.log(`[Inventaire Matching] Step 2: Searching for fuzzy title match with exact author...`);
    for (const res of results) {
        const authorMatch = res.authors?.some(a => 
            compareAuthorNames(a, cleanAuthor)
        ) || false;
        const normResTitle = normalizeTitle(res.label);
        const titleIncluded = normResTitle.includes(normTitleQuery) || 
                              normTitleQuery.includes(normResTitle);
        
        console.log(`[Inventaire Matching]   Checking result: "${res.label}" by [${res.authors?.join(', ') || 'unknown'}]. Title overlap: ${titleIncluded}, Author match: ${authorMatch}`);
        if (authorMatch && titleIncluded) {
            console.log(`[Inventaire Matching]   -> Fuzzy match found! Selected URI: "${res.uri}"`);
            return res.uri;
        }
    }
    
    console.log(`[Inventaire Matching] No suitable match found for "${cleanTitle}" by "${cleanAuthor}" among the search results.`);
    return null;
};

// ─── API: Entities ───────────────────────────────────────────────────────────

export const getInventaireEntities = async (uris: string[]): Promise<Record<string, InventaireEntity>> => {
    if (!uris.length) return {};
    const cacheKey = uris.sort().join('|');
    
    // Return cached promise if exists
    if (entityCache.has(cacheKey)) {
        return entityCache.get(cacheKey)!;
    }
    
    const fetchPromise = (async () => {
        try {
            const uriParam = uris.join('|');
            const url = `${INVENTAIRE_BASE}/api/entities/by-uris?uris=${encodeURIComponent(uriParam)}&lang=fr&props=labels|descriptions|claims|sitelinks|image`;
            const response = await fetchWithAgent(url);
            if (!response.ok) {
                console.error(`[Inventaire API] Entities HTTP error: ${response.status} for URIs: ${uriParam}`);
                throw new Error(`Inventaire entities error: ${response.status}`);
            }
            const data = await response.json();
            return data.entities || {};
        } catch (e) {
            console.error('[Inventaire API] Error fetching entities:', e);
            return {};
        }
    })();
    
    entityCache.set(cacheKey, fetchPromise);
    // Clean cache after 5 minutes
    setTimeout(() => entityCache.delete(cacheKey), 300000);
    
    return fetchPromise;
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
            const rawData = await response.json();
            const validated = InventaireSearchResponseSchema.safeParse(rawData);
            if (!validated.success) {
                console.error('[Inventaire API] Invalid batch search response format:', validated.error);
                continue;
            }
            validated.data.results.forEach((r: any) => {
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
        description: formatted.description || null,
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
    
    const cacheKey = `${lang}:${title}`;
    
    // Return cached promise if exists
    if (wikipediaCache.has(cacheKey)) {
        return wikipediaCache.get(cacheKey)!;
    }
    
    const fetchPromise = (async () => {
        try {
            console.log(`[Wikipedia API] Fetching synopsis for: ${title} (${lang})`);
            const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=4&explaintext=1&exintro=1&titles=${encodeURIComponent(title)}&format=json`;
            // 5s timeout for Wikipedia
            const response = await fetchWithAgent(url, {}, 5000);
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
    })();
    
    wikipediaCache.set(cacheKey, fetchPromise);
    // Clean cache after 5 minutes
    setTimeout(() => wikipediaCache.delete(cacheKey), 300000);
    
    return fetchPromise;
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
