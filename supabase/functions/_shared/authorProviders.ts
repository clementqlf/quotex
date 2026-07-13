import { 
  formatInventaireDate, 
  getInventaireAuthorDetails as fetchInventaireAuthorDetails 
} from './inventaire.api.ts';
import { getAuthorNationality } from './wikidata.ts';

export interface AuthorDetails {
  uri: string;
  name: string | null;
  image: string | null;
  birthDate: string | null;
  nationality: string | null;
  wikipediaTitle: string | null;
  description: string | null;
}

export interface AuthorProvider {
  name: string;
  getAuthorDetails(uri: string): Promise<AuthorDetails | null>;
}

// ─── Provider: Inventaire ───────────────────────────────────────────────────
export const InventaireAuthorProvider: AuthorProvider = {
  name: 'Inventaire',
  async getAuthorDetails(uri: string): Promise<AuthorDetails | null> {
    try {
      console.log(`[Inventaire Provider] Fetching details for: ${uri}`);
      const details = await fetchInventaireAuthorDetails(uri);
      if (!details) return null;
      return {
        uri: details.uri,
        name: details.name,
        image: details.image,
        birthDate: details.birthDate,
        nationality: details.nationality,
        wikipediaTitle: details.wikipediaTitle,
        description: details.description
      };
    } catch (e) {
      console.warn(`[Inventaire Provider] Failed for ${uri}:`, e);
      return null;
    }
  }
};

// Helper to translate nationality QIDs to French labels directly via Wikidata API
const getWikidataLabel = async (qid: string, lang = 'fr'): Promise<string | null> => {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels&languages=${lang}&format=json&origin=*`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const entity = data.entities?.[qid];
    if (!entity) return null;
    const labels = (entity.labels || {}) as Record<string, { value?: string } | undefined>;
    return labels[lang]?.value || Object.values(labels)[0]?.value || null;
  } catch {
    return null;
  }
};

// ─── Provider: Wikidata Direct ────────────────────────────────────────────────
export const WikidataAuthorProvider: AuthorProvider = {
  name: 'Wikidata',
  async getAuthorDetails(uri: string): Promise<AuthorDetails | null> {
    const qid = uri.startsWith('wd:') ? uri.substring(3) : uri;
    if (!/^Q\d+$/.test(qid)) return null;

    try {
      console.log(`[Wikidata Provider] Fetching details for QID: ${qid}`);
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels|descriptions|claims|sitelinks&languages=fr|en&format=json&origin=*`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)' }
      });
      if (!response.ok) {
        console.error(`[Wikidata Provider] API error: ${response.status} for QID: ${qid}`);
        return null;
      }
      const data = await response.json();
      const entity = data.entities?.[qid];
      if (!entity) return null;

      const labels = (entity.labels || {}) as Record<string, { value?: string } | undefined>;
      const name = labels.fr?.value || labels.en?.value || Object.values(labels)[0]?.value || null;

      const descriptions = (entity.descriptions || {}) as Record<string, { value?: string } | undefined>;
      const description = descriptions.fr?.value || descriptions.en?.value || Object.values(descriptions)[0]?.value || null;

      const sitelinks = (entity.sitelinks || {}) as Record<string, { title?: string } | undefined>;
      const wikipediaTitle = sitelinks.frwiki?.title || sitelinks.enwiki?.title || null;

      const p18Claims = entity.claims?.P18 || [];
      const p18Value = p18Claims[0]?.mainsnak?.datavalue?.value;
      const image = p18Value ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p18Value)}?width=500` : null;

      const p569Claims = entity.claims?.P569 || [];
      const p569Value = p569Claims[0]?.mainsnak?.datavalue?.value?.time;
      const birthDate = p569Value ? formatInventaireDate(p569Value) : null;

      const p27Claims = entity.claims?.P27 || [];
      const nationalityQid = p27Claims[0]?.mainsnak?.datavalue?.value?.id;
      let nationality = null;
      if (nationalityQid) {
        nationality = await getWikidataLabel(nationalityQid, 'fr') || `wd:${nationalityQid}`;
      } else {
        // Fallback to SPARQL check
        nationality = await getAuthorNationality(qid);
      }

      return {
        uri: `wd:${qid}`,
        name,
        image,
        birthDate,
        nationality,
        wikipediaTitle,
        description
      };
    } catch (e) {
      console.error(`[Wikidata Provider] Error getting author details for ${qid}:`, e);
      return null;
    }
  }
};

// ─── Orchestrator: authorEnrichmentService ────────────────────────────────────
export const authorEnrichmentService = {
  providers: [
    InventaireAuthorProvider,
    WikidataAuthorProvider
  ] as AuthorProvider[],

  register(provider: AuthorProvider) {
    this.providers.push(provider);
  },

  async getAuthorDetails(uri: string): Promise<AuthorDetails | null> {
    for (const provider of this.providers) {
      try {
        const details = await provider.getAuthorDetails(uri);
        if (details && details.name) {
          console.log(`[AuthorEnrichmentService] Resolved details via: ${provider.name}`);
          return details;
        }
      } catch (e) {
        console.warn(`[AuthorEnrichmentService] Provider ${provider.name} failed for ${uri}:`, e);
      }
    }
    console.error(`[AuthorEnrichmentService] Failed to resolve author details from any provider for: ${uri}`);
    return null;
  }
};
