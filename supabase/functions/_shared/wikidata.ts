
export interface WikidataWork {
    qid: string;
    title: string;
    date?: string;
    openLibraryId?: string;
    genres?: string;
}

/**
 * Searches for an author's Wikidata QID by name.
 */
export const searchAuthorQid = async (authorName: string): Promise<string | null> => {
    try {
        const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(authorName)}&language=fr&format=json&origin=*&type=item`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.search && data.search.length > 0) {
            return data.search[0].id;
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
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
                'Accept': 'application/sparql-results+json'
            }
        });

        if (!res.ok) {
            console.error(`[Wikidata] Query failed: ${res.status} ${res.statusText}`);
            return [];
        }
        const data = await res.json();
        const results = data.results.bindings;
        console.log(`[Wikidata] Found ${results.length} works for QID: ${qid}`);

        return results.map((b: any) => ({
            qid: b.oeuvre.value.split('/').pop() || '',
            title: b.title?.value || 'Sans titre',
            date: b.pubDate?.value,
            openLibraryId: b.openLibraryID?.value,
            genres: b.genres?.value
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

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
                'Accept': 'application/sparql-results+json'
            }
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data.results.bindings[0]?.nationalities?.value || null;
    } catch (e) {
        console.error(`[Wikidata] Error fetching nationality for ${qid}:`, e);
        return null;
    }
};

/**
 * Fetches laureates for a given prize QID.
 */
export const getPrizeLaureates = async (prizeQid: string): Promise<any[]> => {
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
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
                'Accept': 'application/sparql-results+json'
            }
        });

        if (!res.ok) return [];
        const data = await res.json();
        return data.results.bindings.map((b: any) => ({
            year: b.year?.value ? parseInt(b.year.value) : null,
            authorQid: b.laureate?.value.split('/').pop(),
            authorName: b.laureateLabel?.value,
            workQid: b.work?.value.split('/').pop(),
            workTitle: b.workLabel?.value,
        }));
    } catch (e) {
        console.error(`[Wikidata] Error fetching laureates for ${prizeQid}:`, e);
        return [];
    }
};
