// notableWorks.ts — no Prisma dependency, pure HTTP
// Copied from server/src/services/notableWorks.ts — no changes needed

export interface NotableWork {
  title: string;
  uri: string;
}

export const getNotableWorksDetailed = async (authorName: string): Promise<NotableWork[]> => {
  try {
    const sparql = `
      SELECT ?oeuvre ?oeuvreLabel WHERE {
        ?hugo rdfs:label "${authorName}"@fr .
        ?hugo wdt:P31 wd:Q5 .
        ?hugo wdt:P800 ?oeuvre .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
      }
      ORDER BY ?oeuvreLabel
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
        'Accept': 'application/sparql-results+json',
      },
    });
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
    return Array.from(uniqueWorks.values());
  } catch (e) {
    console.error('[NotableWorks] Wikidata error:', e);
    return [];
  }
};
