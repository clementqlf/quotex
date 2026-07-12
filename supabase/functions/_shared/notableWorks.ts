// notableWorks.ts — no Prisma dependency, pure HTTP
// Copied from server/src/services/notableWorks.ts — no changes needed

import { getWorkEditions } from './inventaire.api.ts';

export interface NotableWork {
  title: string;
  uri: string;
}

export const getNotableWorksDetailed = async (authorName: string): Promise<NotableWork[]> => {
  try {
    const sparql = `
      SELECT ?oeuvre ?oeuvreLabel WHERE {
        VALUES ?label { "${authorName}"@fr "${authorName}"@en "${authorName}"@mul }
        ?hugo rdfs:label ?label .
        ?hugo wdt:P31 wd:Q5 .
        ?hugo wdt:P800 ?oeuvre .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
      }
      ORDER BY ?oeuvreLabel
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
          'Accept': 'application/sparql-results+json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok) throw new Error(`SPARQL failed: ${res.status}`);
    const data = await res.json();
    const results = data.results.bindings;
    const uniqueWorks = new Map<string, NotableWork>();
    for (const item of results) {
      const qid = item.oeuvre?.value?.split('/entity/')[1];
      const uri = qid ? `wd:${qid}` : null;
      const title = item.oeuvreLabel?.value || 'Sans titre';
      if (uri && !uniqueWorks.has(title)) {
        uniqueWorks.set(title, { title, uri });
      }
    }

    const works = Array.from(uniqueWorks.values());
    const worksWithEditions: NotableWork[] = [];

    for (const work of works) {
      try {
        const editions = await getWorkEditions(work.uri);
        if (editions.length > 0) {
          worksWithEditions.push(work);
        }
      } catch (editionErr) {
        console.error(`[NotableWorks] Failed to verify editions for ${work.uri}:`, editionErr);
      }
    }

    return worksWithEditions;
  } catch (e) {
    console.error('[NotableWorks] Wikidata error:', e);
    return [];
  }
};
