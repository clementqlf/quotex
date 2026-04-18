import { PrismaClient } from '@prisma/client';
import { getBatchInventaireDetails, getBestNativeCovers } from './inventaire';

const prisma = new PrismaClient();

export interface NotableWork {
    title: string;
    uri: string;
    cover?: string;
    year?: number;
    openLibraryId?: string;
}

/**
 * Fetches notable works (P800) for an author via Wikidata
 * and enriches them via Inventaire.
 */
export const getNotableWorksDetailed = async (authorName: string): Promise<NotableWork[]> => {
    try {
        console.log(`[NotableWorks] Starting fetch for author: ${authorName}`);
        
        const sparql = `
          SELECT ?oeuvre ?oeuvreLabel ?openLibraryID ?cover WHERE {
            ?hugo rdfs:label "${authorName}"@fr .
            ?hugo wdt:P31 wd:Q5 . 
            
            # Œuvres notables (P800)
            ?hugo wdt:P800 ?oeuvre .
    
            # Récupérer l'ID Open Library (P648)
            OPTIONAL { ?oeuvre wdt:P648 ?openLibraryID. }
    
            # Récupérer la couverture (P18)
            OPTIONAL { ?oeuvre wdt:P18 ?cover. }
    
            SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
          }
          ORDER BY ?oeuvreLabel
        `;

        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
                'Accept': 'application/sparql-results+json'
            }
        });

        if (!res.ok) throw new Error(`SPARQL failed: ${res.status}`);
        const data = await res.json();
        const results = data.results.bindings;

        const uris = results
            .map((r: any) => {
                const val = r.oeuvre?.value;
                if (val && val.includes('/entity/')) {
                    return `wd:${val.split('/entity/')[1]}`;
                }
                return null;
            })
            .filter(Boolean) as string[];

        // Fetch enrichment from Inventaire
        let inventaireDetails: Record<string, any> = {};
        let nativeCovers: Record<string, string | null> = {};

        if (uris.length > 0) {
            console.log(`[NotableWorks] Fetching details and native covers for ${uris.length} entities`);
            [inventaireDetails, nativeCovers] = await Promise.all([
                getBatchInventaireDetails(uris),
                getBestNativeCovers(uris)
            ]);
        }

        const uniqueWorks = new Map<string, NotableWork>();

        for (const item of results) {
            const qid = item.oeuvre?.value?.split('/entity/')[1];
            const uri = qid ? `wd:${qid}` : null;
            const invData = uri ? inventaireDetails[uri] : null;

            const title = invData?.title || item.oeuvreLabel?.value || 'Sans titre';
            if (uniqueWorks.has(title)) continue;

            const nativeCover = uri ? nativeCovers[uri] : null;
            const fallbackCover = invData?.image || '';
            const coverUrl = nativeCover || fallbackCover;

            if (nativeCover) {
                console.log(`[NotableWorks] Found native scan for "${title}": ${nativeCover}`);
            }

            const slid = item.openLibraryID?.value;
            console.log(`[NotableWorks] "${title}" → cover: ${coverUrl || '(none)'} | uri: ${uri}`);

            uniqueWorks.set(title, {
                title,
                uri: invData?.uri || uri || '',
                cover: coverUrl,
                year: invData?.year || 0,
                openLibraryId: slid
            });
        }

        return Array.from(uniqueWorks.values());

    } catch (e) {
        console.error('[NotableWorks] Error:', e);
        return [];
    }
};
