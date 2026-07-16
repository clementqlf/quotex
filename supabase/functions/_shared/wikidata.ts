
export interface WikidataWork {
    qid: string;
    title: string;
    date?: string;
    openLibraryId?: string;
    genres?: string;
    cover?: string;
}

export interface WikidataSearchResult {
    id: string;
    label: string;
}

export interface SPARQLBinding {
    [key: string]: {
        type?: string;
        value?: string;
    } | undefined;
}

export interface WikidataLaureate {
    year: number | null;
    authorQid: string | undefined;
    authorName: string | undefined;
    workQid: string | undefined;
    workTitle: string | undefined;
}

export async function wikidataFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
        'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
        'Accept': 'application/json',
        ...(options.headers || {})
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const res = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Wikidata request failed with status ${res.status}: ${body.substring(0, 200)}`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (contentType && !contentType.includes('json') && !contentType.includes('javascript')) {
            const body = await res.text().catch(() => '');
            throw new Error(`Wikidata request failed: non-JSON response returned with content-type "${contentType}": ${body.substring(0, 200)}`);
        }

        return res;
    } finally {
        clearTimeout(timeoutId);
    }
}

export const searchAuthorQid = async (authorName: string): Promise<WikidataSearchResult | null> => {
    try {
        const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(authorName)}&language=fr&format=json&origin=*&type=item`;
        const res = await wikidataFetch(url);
        const data = await res.json();
        if (data.search && data.search.length > 0) {
            return {
                id: data.search[0].id,
                label: data.search[0].label || data.search[0].display?.label?.value || ''
            };
        }
        return null;
    } catch (e) {
        console.error(`[Wikidata] Error searching QID for ${authorName}:`, e);
        return null;
    }
};

/**
 * Fetches works by an author using their Wikidata QID.
 * Uses a refined query to prioritize notable works (with a Wikipedia article)
 * and aggregates genres.
 */
export const getAuthorWorks = async (qid: string): Promise<WikidataWork[]> => {
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
        const res = await wikidataFetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });

        const data = await res.json();
        const results = data.results?.bindings || [];
        console.log(`[Wikidata] Found ${results.length} works for QID: ${qid}`);

        return results.map((b: SPARQLBinding) => ({
            qid: b.oeuvre?.value?.split('/').pop() || '',
            title: b.title?.value || 'Sans titre',
            date: b.pubDate?.value,
            openLibraryId: b.openLibraryID?.value,
            genres: b.genres?.value,
            cover: b.cover?.value || undefined
        }));
    } catch (e) {
        console.error(`[Wikidata] Error fetching works for ${qid}:`, e);
        return [];
    }
};
/**
 * Fetches the nationality of an author using their Wikidata QID.
 */
export const getAuthorNationality = async (qid: string): Promise<string | null> => {
    try {
        const sparql = `
        SELECT (GROUP_CONCAT(DISTINCT ?countryLabel; separator=", ") as ?nationalities) WHERE {
          wd:${qid} wdt:P27 ?country .
          ?country rdfs:label ?countryLabel .
          FILTER(LANG(?countryLabel) = "fr")
        }
        `;
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;

        const res = await wikidataFetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });

        const data = await res.json();
        return data.results?.bindings?.[0]?.nationalities?.value || null;
    } catch (e) {
        console.error(`[Wikidata] Error fetching nationality for ${qid}:`, e);
        return null;
    }
};

/**
 * Fetches laureates for a given prize QID.
 */
export const getPrizeLaureates = async (prizeQid: string): Promise<WikidataLaureate[]> => {
    try {
        const sparql = `
        SELECT DISTINCT ?year ?laureate ?laureateLabel ?work ?workLabel WHERE {
          ?laureate wdt:P31 wd:Q5 . # On ne veut que des humains (auteurs)
          ?laureate p:P166 ?award_stat .
          ?award_stat ps:P166 wd:${prizeQid} .
          ?award_stat pq:P585 ?date .
          BIND(YEAR(?date) AS ?year)
          OPTIONAL { ?award_stat pq:P1686 ?work . }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
        } ORDER BY DESC(?year)
        `;
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;

        console.log(`[Wikidata] Fetching laureates for prize: ${prizeQid}`);
        const res = await wikidataFetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });

        const data = await res.json();
        const bindings = data.results?.bindings || [];
        return bindings.map((b: SPARQLBinding) => ({
            year: b.year?.value ? parseInt(b.year.value) : null,
            authorQid: b.laureate?.value?.split('/').pop(),
            authorName: b.laureateLabel?.value,
            workQid: b.work?.value?.split('/').pop(),
            workTitle: b.workLabel?.value,
        }));
    } catch (e) {
        console.error(`[Wikidata] Error fetching laureates for ${prizeQid}:`, e);
        return [];
    }
};

/**
 * Filters a list of Wikidata QIDs to keep only those that represent authors/writers.
 */
export const filterWikidataAuthors = async (qids: string[]): Promise<Set<string>> => {
    if (qids.length === 0) return new Set();

    // Clean and validate QIDs (must match Q\d+)
    const cleanQids = qids
        .map(id => id.startsWith('wd:') ? id.substring(3) : id)
        .filter(id => /^Q\d+$/.test(id));

    if (cleanQids.length === 0) return new Set();

    try {
        const sparql = `
        SELECT DISTINCT ?author WHERE {
          VALUES ?author { ${cleanQids.map(id => `wd:${id}`).join(' ')} }
          {
            ?work wdt:P50 ?author .
            ?work wdt:P31/wdt:P279* ?type .
            FILTER(?type IN (wd:Q571, wd:Q7725634, wd:Q47461344))
          } UNION {
            ?author wdt:P800 ?work .
            ?work wdt:P31/wdt:P279* ?type .
            FILTER(?type IN (wd:Q571, wd:Q7725634, wd:Q47461344))
          } UNION {
            ?author wdt:P106/wdt:P279* wd:Q36180 .
          }
        }
        `;
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;

        const res = await wikidataFetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });

        const data = await res.json();
        const bindings = data.results?.bindings || [];
        const validQids = new Set<string>();
        for (const b of bindings) {
            const uri = b.author?.value || '';
            const qid = uri.split('/').pop();
            if (qid) validQids.add(qid);
        }
        return validQids;
    } catch (e) {
        console.error('[Wikidata] Error filtering authors via SPARQL:', e);
        // Fallback on error to avoid false negatives
        return new Set(cleanQids);
    }
};

