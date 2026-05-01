import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const INVENTAIRE_BASE = 'https://inventaire.io';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InventaireSearchResult {
    id: string;
    uri: string;         // ex. "wd:Q34670" or "inv:abc123"
    type: string;        // "works" | "humans"
    label: string;
    image?: string;      // Full URL, resolved from /img/entities/<hash>
    authors?: string[];  // Author names natively attached
    authorUris?: string[]; // Author URIs (wdt:P50) for direct enrichment
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveImageUrl = (raw: string | undefined): string | null => {
    if (!raw) return null;
    // If it's already a full URL (like Wikimedia Commons), return as is
    if (raw.startsWith('http')) return raw;
    // Format: "/img/entities/<hash>" → prepend base
    if (raw.startsWith('/img/')) return `${INVENTAIRE_BASE}${raw}`;
    return null;
};

/**
 * Checks if an image URL is a native Inventaire scan (hosted on their servers)
 * rather than a fallback to Wikimedia Commons.
 */
export const isNativeScan = (url: string | null | undefined): boolean => {
    return !!(url && url.includes('/img/entities/'));
};

export const getEntityImage = (imageObj: any): string | null => {
    if (!imageObj) return null;

    // 1. Native Inventaire user-uploaded image
    if (imageObj.file && imageObj.file.startsWith('/img/')) {
        return resolveImageUrl(imageObj.file);
    }

    // 2. Fallback to the external URL (usually Wikimedia Commons provided by Wikidata)
    return resolveImageUrl(imageObj.url);
};

const safeFirstClaim = (claims: Record<string, any[]>, property: string): string | null => {
    return claims?.[property]?.[0] ?? null;
};

/**
 * Formats a Wikidata/Inventaire date string into a human-readable French format.
 * ex: "+2003-06-13T00:00:00Z" -> "13 juin 2003"
 */
const formatInventaireDate = (rawDate: string | null): string | null => {
    if (!rawDate) return null;

    // Wikidata dates often look like "+2003-06-13T00:00:00Z"
    let cleanDate = rawDate.startsWith('+') ? rawDate.substring(1) : rawDate;

    // Handle partial dates (e.g., "+1980-00-00T00:00:00Z")
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

/**
 * Standardizes a raw Inventaire entity into a consistent format used across the app.
 */
const formatInventaireWork = (entity: any, uri?: string): Partial<InventaireWorkDetails> & { label?: string, authors?: string[] } => {
    if (!entity) return {};

    const claims = entity.claims || {};
    const labels = entity.labels || {};
    const descriptions = entity.descriptions || {};

    const label = labels['fr'] || labels['en'] || (entity as any).label || Object.values(labels)[0] || null;

    const publishDateRaw = safeFirstClaim(claims, 'wdt:P577');
    const year = publishDateRaw ? parseInt(publishDateRaw.substring(0, 4)) : null;

    // Resolve Image
    const imageUrl = getEntityImage(entity.image);

    const sitelinks = entity.sitelinks || {};

    return {
        uri: entity.uri || uri,
        title: label as string | null,
        year,
        image: imageUrl,
        authorUris: claims['wdt:P50'] || [],
        genreUris: claims['wdt:P136'] || [],
        wikipediaTitle: sitelinks['frwiki']?.title || sitelinks['enwiki']?.title || null,
        pages: safeFirstClaim(claims, 'wdt:P1104') ? parseInt(safeFirstClaim(claims, 'wdt:P1104')!) : null,
        label: label as string // For search result compatibility
    };
};

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Generic search for entities on Inventaire.io
 */
export const searchInventaire = async (
    query: string,
    types: string = 'works',
    limit = 10
): Promise<InventaireSearchResult[]> => {
    if (!query.trim()) return [];
    console.log(`[Inventaire] Searching for "${query}" (types: ${types})`);
    try {
        const typesList = types.split(',');
        const typesParam = typesList.map(t => `types=${encodeURIComponent(t.trim())}`).join('&');
        const url = `${INVENTAIRE_BASE}/api/search?${typesParam}&search=${encodeURIComponent(query)}&limit=${limit}&lang=fr`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Inventaire search error: ${response.status}`);
        const data = await response.json();

        const basicResults = (data.results || []).map((r: any) => ({
            id: r.id,
            uri: r.uri,
            type: r.type,
            label: r.label || '',
            image: resolveImageUrl(r.image),
            authors: []
        }));

        if (basicResults.length === 0) return [];

        // 1. Fetch work entities to get Author URIs (wdt:P50)
        // We filter for results that ARE works or might have author claims
        const urisToFetch = basicResults.map((r: any) => r.uri);
        const entities = await getInventaireEntities(urisToFetch);

        const authorUrisToFetch = new Set<string>();
        for (const uri of urisToFetch) {
            const entity = entities[uri];
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

        // 3. Attach authors and metadata to results
        for (const result of basicResults) {
            const entity = entities[result.uri];
            if (entity) {
                // Formatting for works specifically (but safe for others)
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

        console.log(`[Inventaire] Search complete. Found ${basicResults.length} results.`);
        return basicResults;
    } catch (e) {
        console.error('[Inventaire] Error searching:', e);
        return [];
    }
};

/**
 * Search for books (works) on Inventaire.io.
 * Now uses "Sujets" (works, genres, movements) by default to improve discoverability.
 */
export const searchInventaireWorks = async (
    query: string,
    limit = 10
): Promise<InventaireSearchResult[]> => {
    // Defaulting to subjects (works + genres + movements) as requested by the user
    return searchInventaire(query, 'works,genres,movements', limit);
};

/**
 * Finds a specific work URI on Inventaire.io based on a title and author name.
 * Used for "discovery" when we only have text data.
 */
export const findWorkUriByTitleAndAuthor = async (
    title: string,
    authorName: string
): Promise<string | null> => {
    if (!title || !authorName) return null;
    const cleanTitle = title.trim();
    const cleanAuthor = authorName.trim();

    console.log(`[Inventaire/Discovery] Searching for Work: "${cleanTitle}" by "${cleanAuthor}"`);

    // Search for "Title Author" to improve relevance
    const searchQuery = `"${cleanTitle}" ${cleanAuthor}`;
    const results = await searchInventaireWorks(searchQuery, 20
    );

    console.log(`[Inventaire/Discovery] Found ${results.length} potential matches.`);

    if (results.length === 0) {
        console.log(`[Inventaire/Discovery] ❌ No results found for "${searchQuery}"`);
        return null;
    }

    // Try to find the best match
    // 1. Exact title match (case insensitive) among results that have the author
    for (const res of results) {
        const titleMatch = res.label.toLowerCase().trim() === cleanTitle.toLowerCase();
        const authorMatch = res.authors?.some(a => a.toLowerCase().includes(cleanAuthor.toLowerCase())) || false;

        console.log(`[Inventaire/Discovery] Checking: "${res.label}" | Author Match: ${authorMatch} | Title Match: ${titleMatch}`);

        if (titleMatch && authorMatch) {
            console.log(`[Inventaire/Discovery] ✅ High-confidence match found: ${res.label} (${res.uri})`);
            return res.uri;
        }
    }

    // 2. Fallback: If title is very similar and author matches
    for (const res of results) {
        const authorMatch = res.authors?.some(a => a.toLowerCase().includes(cleanAuthor.toLowerCase())) || false;
        if (authorMatch) {
            console.log(`[Inventaire/Discovery] ⚠️ Partial match found (Author match): ${res.label} (${res.uri})`);
            return res.uri;
        }
    }

    console.log(`[Inventaire/Discovery] ❌ No reliable match found for "${title}" by "${authorName}"`);
    return null;
};


/**
 * Search for authors (humans) on Inventaire.io
 */
export const searchInventaireAuthors = async (
    query: string,
    limit = 10
): Promise<InventaireSearchResult[]> => {
    return searchInventaire(query, 'humans', limit);
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
        const url = `${INVENTAIRE_BASE}/api/entities/by-uris?uris=${encodeURIComponent(uriParam)}&lang=fr`;
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
 * Fetch a batch of entities by URI from the SEARCH API to get representative covers.
 * This is much more reliable for finding "the best" image than the entities API.
 */
export const getBatchInventaireSearchMetadata = async (uris: string[]): Promise<Record<string, { image: string | null, label: string | null }>> => {
    if (!uris.length) return {};

    // Extract IDs and build the OR query
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
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = await response.json();

            (data.results || []).forEach((r: any) => {
                if (r.uri) {
                    results[r.uri] = {
                        image: resolveImageUrl(r.image),
                        label: r.label || null
                    };
                }
            });
        } catch (e) {
            console.error('[Inventaire] Error in batch search metadata:', e);
        }
    }

    return results;
};

/**
 * Get work details from a URI
 */
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

/**
 * Fetch a short synopsis from Wikipedia using the exact page title
 */
export const fetchWikipediaSynopsis = async (title: string, lang: string = 'fr'): Promise<string | null> => {
    if (!title) return null;
    try {
        console.log(`[Wikipedia] Fetching synopsis for: ${title} (${lang})`);
        const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=4&explaintext=1&exintro=1&titles=${encodeURIComponent(title)}&format=json`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        const pages = data.query?.pages;
        if (!pages) return null;
        const firstPageId = Object.keys(pages)[0];
        if (firstPageId === '-1') return null;

        const extract = pages[firstPageId]?.extract;
        if (!extract || extract.trim().length === 0) {
            console.log(`[Wikipedia] No extract found for title: ${title}`);
            return null;
        }
        console.log(`[Wikipedia] Successfully fetched synopsis for ${title} (${extract.length} chars)`);
        return extract.trim();
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
    const rawBirthDate = safeFirstClaim(claims, 'wdt:P569');
    const birthDate = formatInventaireDate(rawBirthDate);
    const nationalityUri = safeFirstClaim(claims, 'wdt:P27');

    const imageUrl = getEntityImage(entity.image);

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
 * Get all work URIs for a given author URI (reverse claim P50)
 */
export const getAuthorWorkUris = async (authorUri: string): Promise<string[]> => {
    try {
        const url = `${INVENTAIRE_BASE}/api/entities?action=reverse-claims&property=wdt:P50&value=${encodeURIComponent(authorUri)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Inventaire reverse-claims error (wdt:P50): ${response.status}`);
        const data = await response.json();
        return data.uris || [];
    } catch (e) {
        console.error('[Inventaire] Error fetching author work URIs:', e);
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
            const cover = getEntityImage((e as any).image);

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
/**
 * Fetch a batch of entities and return formatted details (title, cover, year, etc.)
 */
export const getBatchInventaireDetails = async (uris: string[]): Promise<Record<string, Partial<InventaireWorkDetails>>> => {
    if (!uris.length) return {};
    const entities = await getInventaireEntities(uris);
    const results: Record<string, Partial<InventaireWorkDetails>> = {};

    for (const [uri, entity] of Object.entries(entities)) {
        if (!entity) continue;
        results[uri] = formatInventaireWork(entity, uri);

        // If pages missing from work, we could optionally fetch editions here, 
        // but to keep it fast for batch, we only do it if the entity already has it.
    }
    return results;
};

/**
 * Orchestrates complete enrichment for a work (metadata + description + pages)
 */
export const enrichWorkMetadata = async (uri: string): Promise<any> => {
    console.log(`[Inventaire] Starting full enrichment for ${uri}`);
    const details = await getInventaireWorkDetails(uri);
    if (!details) return null;

    const nativeUri = details.uri;
    const result: any = {
        title: details.title,
        year: details.year,
        image: details.image,
        inventaireUri: nativeUri,
        authorUris: details.authorUris,
        wikipediaTitle: details.wikipediaTitle,
        description: null,
        pages: 0,
        authors: []
    };

    // 1. Authors names
    if (details.authorUris.length > 0) {
        const authorEntities = await getInventaireEntities([details.authorUris[0]]);
        const authorEntry = authorEntities[details.authorUris[0]];
        if (authorEntry && authorEntry.labels) {
            result.authors = [authorEntry.labels['fr'] || authorEntry.labels['en'] || Object.values(authorEntry.labels)[0]];
        }
    }

    // 2. Wikipedia Synopsis (FR only)
    if (details.wikipediaTitle) {
        const synopsis = await fetchWikipediaSynopsis(details.wikipediaTitle, 'fr');
        if (synopsis) {
            result.description = synopsis;
            console.log(`[Inventaire] Found Wikipedia (FR) synopsis: ${synopsis}`);
        }
    }

    // 3. Editions & Page count (from editions of the NATIVE URI)
    try {
        // Try to get representative image from search first (it's often better)
        const searchMetadata = await getBatchInventaireSearchMetadata([uri]);
        if (isNativeScan(searchMetadata[uri]?.image)) {
            result.image = searchMetadata[uri].image;
            console.log(`[Inventaire] Prioritized representative search image: ${result.image}`);
        }

        const editions = await getWorkEditions(nativeUri);
        result.editions = editions; // Store the full list

        if (editions.length > 0) {
            // Find best cover and page count from editions
            const scoredEds = editions.map(e => {
                let score = 0;
                if (e.languageUri === 'wd:Q150') score += 10;
                if (e.cover?.includes('/img/entities/')) score += 5;
                if (e.isbn) score += 2;
                if (e.pages && e.pages > 0) score += 1;
                return { ed: e, score };
            }).sort((a, b) => b.score - a.score);

            const bestEd = scoredEds[0].ed;
            if (bestEd.cover) {
                result.image = bestEd.cover;
                console.log(`[Inventaire] Best cover found from editions: ${result.image}`);
            }

            const editionWithPages = editions.find(e => e.pages && e.pages > 0);
            if (editionWithPages) {
                result.pages = editionWithPages.pages;
                console.log(`[Inventaire] Found page count: ${result.pages}`);
            }

            if (!result.year) {
                const editionWithYear = editions.find(e => e.publishDate);
                if (editionWithYear && editionWithYear.publishDate) {
                    result.year = parseInt(editionWithYear.publishDate.substring(0, 4));
                    console.log(`[Inventaire] Fallback year found from editions: ${result.year}`);
                }
            }
        }
    } catch (err) {
        console.error(`[Inventaire] Failed to fetch editions for pages/covers`, err);
    }

    console.log(`[Inventaire] Enrichment finished for "${result.title}". Year: ${result.year || 'None'}, Pages: ${result.pages || 'None'}`);

    return result;
};

export const authorEnrichmentQueue: Set<number> = new Set();

/**
 * Orchestrates complete enrichment for an author (metadata + biography + image)
 */
export const syncAuthorProfile = async (authorId: number, authorName?: string, authorUri?: string): Promise<any> => {
    if (authorEnrichmentQueue.has(authorId)) return null;
    authorEnrichmentQueue.add(authorId);

    try {
        await prisma.author.update({ where: { id: authorId }, data: { isEnriching: true } as any }).catch(() => { });
        console.log(`[Inventaire] Starting enrichment for author ID: ${authorId}`);

        // 1. Get author from DB
        const author = await (prisma.author as any).findUnique({ where: { id: authorId } });
        if (!author) return null;

        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        const lastEnriched = author.lastEnrichedAt ? new Date(author.lastEnrichedAt).getTime() : 0;
        const isProfileFresh = (now - lastEnriched) < SEVEN_DAYS;

        if (isProfileFresh) {
            console.log(`[Inventaire] Author ${author.name} is already freshly enriched. Skipping.`);
            return author;
        }
        
        const nameToSearch = authorName || author.name;
        let uri = authorUri || author.inventaireUri;

        // 2. Resolve URI if missing
        if (!uri) {
            console.log(`[Inventaire] Searching for author: ${nameToSearch}`);
            const searchResults = await searchInventaireAuthors(nameToSearch, 5);
            if (searchResults.length > 0) {
                // Pick the best match (case insensitive title match or just the first one)
                const match = searchResults.find(r => r.label.toLowerCase() === nameToSearch.toLowerCase()) || searchResults[0];
                uri = match.uri;
                console.log(`[Inventaire] Resolved URI: ${uri}`);
            }
        }

        if (!uri) {
            console.log(`[Inventaire] Could not resolve Inventaire URI for ${nameToSearch}`);
            return null;
        }

        // 3. Get Author Details
        const details = await getInventaireAuthorDetails(uri);
        if (!details) return null;

        const isNewEntity = uri !== author.inventaireUri;

        // 4. Fetch Biography from Wikipedia (FR)
        let biography = isNewEntity ? null : author.description;
        // Force fetch if it's a new entity, or if biography is missing/short
        if (details.wikipediaTitle && (isNewEntity || !biography || biography.length < 50)) {
            console.log(`[Inventaire] Fetching biography from Wikipedia for: ${details.wikipediaTitle}`);
            const synopsis = await fetchWikipediaSynopsis(details.wikipediaTitle, 'fr');
            if (synopsis) {
                biography = synopsis;
                console.log(`[Inventaire] Successfully retrieved biography (${biography.length} chars): ${biography.substring(0, 500)}...`);
            } else {
                console.log(`[Inventaire] Wikipedia fetch returned no synopsis for: ${details.wikipediaTitle}`);
            }
        }

        // 5. Build update data
        // If it's a new entity, we overwrite everything. If same entity, we only fill missing fields.
        const updateData: any = {
            inventaireUri: uri,
        };

        // Standardize name if different and no conflict
        if (details.name && author.name !== details.name) {
            const conflict = await prisma.author.findUnique({ where: { name: details.name } });
            if (!conflict) {
                updateData.name = details.name;
                console.log(`[Inventaire] Standardizing author name: "${author.name}" -> "${details.name}"`);
            }
        }

        updateData.description = isNewEntity ? biography : (biography || author.description);
        updateData.image = isNewEntity ? details.image : (details.image || author.image);
        updateData.birthDate = isNewEntity ? details.birthDate : (details.birthDate || author.birthDate);
        updateData.nationality = isNewEntity ? details.nationality : (details.nationality || author.nationality);

        if (details.image) {
            console.log(`[Inventaire] Author image resolved: ${details.image}`);
        } else {
            console.log(`[Inventaire] No author image found on Inventaire for ${nameToSearch}`);
        }

        // 6. Resolve nationality label if it's a URI
        if (updateData.nationality && (updateData.nationality.startsWith('wd:') || updateData.nationality.startsWith('inv:'))) {
            try {
                const natEntities = await getInventaireEntities([updateData.nationality]);
                const natEntity = natEntities[updateData.nationality];
                if (natEntity && natEntity.labels) {
                    updateData.nationality = natEntity.labels['fr'] || natEntity.labels['en'] || Object.values(natEntity.labels)[0];
                }
            } catch (err) {
                console.error(`[Inventaire] Failed to resolve nationality label`, err);
            }
        }

        // 7. Update DB
        updateData.lastEnrichedAt = new Date();
        const updatedAuthor = await prisma.author.update({
            where: { id: authorId },
            data: updateData
        });

        console.log(`[Inventaire] Enrichment complete for ${updatedAuthor.name}`);

        

        return updatedAuthor;

    } catch (e) {
        console.error(`[Inventaire] Author enrichment error:`, e);
        return null;
    } finally {
        await prisma.author.update({ where: { id: authorId }, data: { isEnriching: false } as any }).catch(() => { });
        authorEnrichmentQueue.delete(authorId);
    }
};

/**
 * For a list of work URIs, finds the "best" native cover by looking at their editions.
 * Prioritizes scans over Wikimedia fallbacks and editions with ISBNs.
 */

export const discoverAuthorWorks = async (authorId: number, authorUri?: string): Promise<void> => {
    try {
        const author = await (prisma.author as any).findUnique({ where: { id: authorId } });
        if (!author) return;

        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        const lastDiscovered = author.lastDiscoveredAt ? new Date(author.lastDiscoveredAt).getTime() : 0;
        const isDiscoveryFresh = (now - lastDiscovered) < SEVEN_DAYS;

        if (isDiscoveryFresh) {
            console.log(`[Inventaire] Author ${author.name} works already discovered recently. Skipping.`);
            return;
        }

        const uri = authorUri || author.inventaireUri;
        if (!uri) return;

        console.log(`[Inventaire] Discovering all works for author: ${author.name} (${uri})`);
        const workUris = await getAuthorWorkUris(uri);

        if (workUris.length > 0) {
            console.log(`[Inventaire] Found ${workUris.length} works for author ${author.name}`);

            const limitedUris = workUris.slice(0, 100);
            const CHUNK_SIZE = 25;
            for (let i = 0; i < limitedUris.length; i += CHUNK_SIZE) {
                const chunk = limitedUris.slice(i, i + CHUNK_SIZE);
                const [workEntities, bestCovers] = await Promise.all([
                    getBatchInventaireDetails(chunk),
                    getBestNativeCovers(chunk)
                ]);

                for (const [wUri, details] of Object.entries(workEntities)) {
                    if (!details || !details.title) continue;

                    const bestCover = bestCovers[wUri];
                    const finalCover = bestCover || details.image || null;
                    const bookTitle = details.title.trim();

                    const existingBook = await prisma.book.findFirst({
                        where: {
                            OR: [
                                { inventaireUri: wUri },
                                { AND: [{ title: bookTitle }, { authorId: author.id }] }
                            ]
                        }
                    });

                    if (!existingBook) {
                        console.log(`[Inventaire] Auto-importing discovered work: ${bookTitle} for Author ID: ${author.id}`);
                        try {
                            await prisma.book.create({
                                data: {
                                    title: bookTitle,
                                    authorId: author.id,
                                    inventaireUri: wUri,
                                    cover: finalCover,
                                    year: details.year || 0,
                                    description: '',
                                    genre: ''
                                }
                            });
                        } catch (err: any) {
                            if (err.code === 'P2002') {
                                console.log(`[Inventaire] Book "${bookTitle}" already exists (race condition), skipping.`);
                            }
                        }
                    } else if (!existingBook.inventaireUri) {
                        await prisma.book.update({
                            where: { id: existingBook.id },
                            data: { inventaireUri: wUri }
                        });
                    }
                }
            }
        }

        await prisma.author.update({
            where: { id: authorId },
            data: { lastDiscoveredAt: new Date() } as any
        });

    } catch (e) {
        console.error(`[Inventaire] Author discovery error:`, e);
    }
};

/**
 * Orchestrates complete enrichment for an author (metadata + biography + image + works)
 */
export const enrichAuthorWithInventaire = async (authorId: number, authorName?: string, authorUri?: string, skipDiscovery: boolean = false): Promise<any> => {
    const author = await syncAuthorProfile(authorId, authorName, authorUri);
    if (!author) return null;
    
    if (!skipDiscovery) {
        await discoverAuthorWorks(authorId, author.inventaireUri);
    }
    return author;
};

export const getBestNativeCovers = async (workUris: string[]): Promise<Record<string, string | null>> => {
    if (!workUris.length) return {};
    console.log(`[Inventaire] Searching for native covers for ${workUris.length} works...`);

    const results: Record<string, string | null> = {};

    try {
        // 1. Fetch edition URIs for each work in parallel
        const editionUrisPerWork = await Promise.all(workUris.map(async uri => {
            const edUris = await getWorkEditionUris(uri);
            return { workUri: uri, edUris };
        }));

        // 2. Collate top edition URIs to fetch details in batch
        // We take up to 10 editions per work to find a good one
        const allEdUris = editionUrisPerWork.flatMap(x => x.edUris.slice(0, 10));
        if (allEdUris.length === 0) return results;

        const allEdDetails = await getEditionsDetails(allEdUris);

        // 3. Selection logic per work with scoring
        // Priority 0: Get representative images from search index
        const searchMetadata = await getBatchInventaireSearchMetadata(workUris);

        for (const { workUri, edUris } of editionUrisPerWork) {
            // Priority 1: Search-indexed representative image (ONLY IF NATIVE)
            const searchImg = searchMetadata[workUri]?.image;
            if (isNativeScan(searchImg)) {
                results[workUri] = searchImg;
                console.log(`[Inventaire] Using representative search cover for ${workUri}`);
                continue;
            }

            const eds = allEdDetails.filter(d => edUris.includes(d.inventaireUri));
            if (eds.length === 0) continue;

            // Sorting logic based on score
            // Native (+10), French (+5), ISBN (+2), Pages (+1)
            const bestEd = eds.sort((a, b) => {
                const getScore = (ed: any) => {
                    let score = 0;
                    if (ed.languageUri === 'wd:Q150') score += 10;
                    if (ed.cover?.includes('/img/entities/')) score += 5;
                    if (ed.isbn) score += 2;
                    if ((ed.pages || 0) > 0) score += 1;
                    return score;
                };
                return getScore(b) - getScore(a);
            })[0];

            if (bestEd?.cover) {
                results[workUri] = bestEd.cover;
            }
        }
    } catch (err) {
        console.error(`[Inventaire] Error in getBestNativeCovers:`, err);
    }

    return results;
};
