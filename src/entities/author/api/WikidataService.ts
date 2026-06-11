import { Book } from '@/src/shared/api/types';
import { API_BASE_URL } from '@/src/shared/config/api';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';
import { z } from 'zod';

const SparqlResultSchema = z.object({
  results: z.object({
    bindings: z.array(z.record(z.any()))
  })
});

export class WikidataService {
    private enrichmentCache = new Map<string, Promise<Record<string, any>>>();

    private async runSPARQL(query: string): Promise<any[]> {
        if (await isOffline()) {
            return [];
        }

        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Quotex/1.0 (got@example.com)', // Good practice for Wikidata
                    'Accept': 'application/sparql-results+json'
                }
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                console.warn(`[WikidataService] SPARQL HTTP error: ${response.status}`);
                return [];
            }
            const data = await response.json();
            try {
                return SparqlResultSchema.parse(data).results.bindings;
            } catch (parseError) {
                console.error('[WikidataService] Invalid SPARQL format:', parseError);
                return [];
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name !== 'AbortError') {
                logFetchError('[WikidataService] SPARQL Error', error);
            }
            return [];
        }
    }

    // Alias for backward compatibility, defaults to notable works for the main view
    async getBooksByAuthor(authorName: string, _openLibraryId?: string): Promise<Book[]> {
        return this.getNotableWorks(authorName);
    }

    private async fetchEnrichment(uris: string[]): Promise<Record<string, any>> {
        const cacheKey = uris.join('|');
        if (!this.enrichmentCache.has(cacheKey)) {
            const promise = this.fetchFromBackendSafe(uris);
            this.enrichmentCache.set(cacheKey, promise);
            setTimeout(() => this.enrichmentCache.delete(cacheKey), 300000);
        }
        return this.enrichmentCache.get(cacheKey)!;
    }

    private async fetchFromBackendSafe(uris: string[]): Promise<Record<string, any>> {
        if (await isOffline()) return {};
        try {
            const response = await fetch(`${API_BASE_URL}/inventaire/entities?uris=${encodeURIComponent(uris.join('|'))}`);
            if (!response.ok) return {};
            return await response.json();
        } catch (err) {
            logFetchError('[WikidataService] Enrichment failed', err);
            return {};
        }
    }

    async getNotableWorks(authorName: string): Promise<Book[]> {
        const query = `
      SELECT ?oeuvre ?oeuvreLabel ?article ?openLibraryID ?cover WHERE {
        VALUES ?label { "${authorName}"@fr "${authorName}"@en "${authorName}"@mul }
        ?hugo rdfs:label ?label .
        ?hugo wdt:P31 wd:Q5 . # Ensure it's a human (Author)
        
        # Œuvres notables (P800)
        ?hugo wdt:P800 ?oeuvre .

        # Page Wikipédia en français de l'œuvre
        OPTIONAL {
          ?article schema:about ?oeuvre ;
                   schema:isPartOf <https://fr.wikipedia.org/> .
        }

        # Récupérer l'ID Open Library (P648)
        OPTIONAL { ?oeuvre wdt:P648 ?openLibraryID. }

        # Récupérer la couverture (P18)
        OPTIONAL { ?oeuvre wdt:P18 ?cover. }

        SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
      }
      ORDER BY ?oeuvreLabel
    `;

        const results = await this.runSPARQL(query);

        // Extract QIDs for batch enrichment from Inventaire
        const uris = results
            .map((r: any) => {
                const val = r.oeuvre?.value;
                if (val && val.includes('/entity/')) {
                    return `wd:${val.split('/entity/')[1]}`;
                }
                return null;
            })
            .filter(Boolean) as string[];

        // Fetch enrichment from our backend with cache
        let inventaireDetails: Record<string, any> = {};
        if (uris.length > 0) {
            inventaireDetails = await this.fetchEnrichment(uris);
        }

        const uniqueTitles = new Set();
        return results
            .map((item: any) => {
                const qid = item.oeuvre?.value?.split('/entity/')[1];
                const uri = qid ? `wd:${qid}` : null;
                const invData = uri ? inventaireDetails[uri] : null;

                // Priority: Inventaire Image > OpenLibrary Image (via SLID) > Wikidata Image
                let coverUrl = invData?.image || '';
                const slid = item.openLibraryID?.value;

                if (!coverUrl && slid) {
                    coverUrl = `https://covers.openlibrary.org/b/olid/${slid}-L.jpg`;
                }
                if (!coverUrl) {
                    coverUrl = item.cover?.value || '';
                }

                // Title Priority: Inventaire > Wikidata
                const title = invData?.title || item.oeuvreLabel?.value || 'Sans titre';

                return {
                    id: 0,
                    title: title,
                    author: authorName,
                    cover: coverUrl,
                    year: invData?.year || 0,
                    description: '',
                    pages: invData?.pages || 0,
                    rating: 0,
                    genre: '',
                    buyLinks: [],
                    inventaireUri: uri || undefined,
                    openLibraryId: item.openLibraryID?.value || undefined
                };
            })
            .filter((book: Book) => {
                if (uniqueTitles.has(book.title)) return false;
                uniqueTitles.add(book.title);
                return true;
            });
    }

    async getAllWorks(authorName: string): Promise<Book[]> {
        console.log('[WikidataService] getAllWorks checking for:', authorName);

        const query = `
        SELECT ?oeuvre ?title ?openLibraryID ?cover ?pubDate ?genres WHERE {
          {
            SELECT ?oeuvre (SAMPLE(?openLibraryID_val) as ?openLibraryID) (SAMPLE(?cover_val) as ?cover) (SAMPLE(?pubDate_val) as ?pubDate) (GROUP_CONCAT(DISTINCT ?genreLabel; separator=", ") as ?genres) 
            WHERE {
              # Auteur identifié par son nom
              ?auteur rdfs:label ?nomAuteur .
              FILTER(CONTAINS(LCASE(?nomAuteur), "${authorName.toLowerCase()}"))
              FILTER(LANG(?nomAuteur) = "fr")

              # Ses œuvres
              ?oeuvre wdt:P50 ?auteur .

              # Page Wikipédia en français (filtre de pertinence)
              ?article schema:about ?oeuvre ;
                       schema:isPartOf <https://fr.wikipedia.org/> .

              # Open Library ID (obligatoire)
              ?oeuvre wdt:P648 ?openLibraryID_val .

              # Données optionnelles
              OPTIONAL { ?oeuvre wdt:P18 ?cover_val. }
              OPTIONAL { ?oeuvre wdt:P577 ?pubDate_val. }
              
              # Genres (récupération manuelle du label pour group_concat)
              OPTIONAL { 
                ?oeuvre wdt:P136 ?genre. 
                ?genre rdfs:label ?genreLabel .
                FILTER(LANG(?genreLabel) = "fr")
              }
            }
            GROUP BY ?oeuvre
          }
          # Récupération explicite des labels pour éviter les QID
          OPTIONAL { ?oeuvre rdfs:label ?lblFr . FILTER(LANG(?lblFr) = "fr") }
          OPTIONAL { ?oeuvre rdfs:label ?lblEn . FILTER(LANG(?lblEn) = "en") }
          BIND(COALESCE(?lblFr, ?lblEn) AS ?title)
        }
        ORDER BY ?title
        `;

        const results = await this.runSPARQL(query);
        console.log('[WikidataService] getAllWorks found results:', results.length);

        const uniqueTitles = new Set();
        return results
            .map((item: any) => {
                let coverUrl = item.cover?.value || '';
                const slid = item.openLibraryID?.value;

                // Prioritize Open Library cover if ID exists
                if (slid) {
                    coverUrl = `https://covers.openlibrary.org/b/olid/${slid}-L.jpg`;
                }

                const year = item.pubDate?.value ? new Date(item.pubDate.value).getFullYear() : 0;
                return {
                    id: 0,
                    title: item.title?.value || 'Sans titre',
                    author: authorName,
                    cover: coverUrl,
                    year: year,
                    description: '',
                    pages: (item as any).pages?.value || 0,
                    rating: 0,
                    genre: item.genres?.value || '',
                    buyLinks: []
                };
            })
            .filter((book: Book) => {
                if (uniqueTitles.has(book.title)) return false;
                uniqueTitles.add(book.title);
                return true;
            });
    }
}

export const wikidataService = new WikidataService();
