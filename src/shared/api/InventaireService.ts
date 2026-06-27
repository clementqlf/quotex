const INVENTAIRE_HEADERS = { 'User-Agent': 'QuotexApp/1.0' };

// ========== TYPES ==========

export interface InventaireImage {
  url?: string;
  file?: string;
  thumbnail?: string;
}

export interface InventaireEntity {
  uri: string;
  type: 'work' | 'author' | 'series' | 'edition' | 'publisher' | string;
  label?: string;
  title?: string;
  description?: string;
  image?: InventaireImage | string;
  cover?: InventaireImage | string;
  author?: string | string[];
  authorUris?: string[];
  authors?: InventaireEntity[];
  year?: number | string;
  pages?: number;
  claims?: Record<string, unknown[]>;
  labels?: Record<string, string>;
  descriptions?: Record<string, string>;
}

export interface InventaireEdition {
  id?: string;
  uri?: string;
  isbn?: string;
  title?: string;
  workUri?: string;
  publisher?: string;
  publisherUri?: string;
  publishDate?: string;
  pages?: number;
  language?: string;
  languageUri?: string;
  cover?: InventaireImage | string;
  format?: string;
}

// ========== HELPERS ==========

/**
 * Normalize an Inventaire URI by trimming and removing wd: prefix
 */
export const normalizeInventaireUri = (uri?: string | null): string => {
  if (!uri) return '';
  return uri.trim().toLowerCase().replace(/^wd:/, '');
};

/**
 * Convert an Inventaire image object to a full URL
 * Handles string URLs, {url: string}, and {file: string} formats
 */
export const getInventaireImageUrl = (imageObj: InventaireImage | string | null): string | null => {
  if (!imageObj) return null;
  if (typeof imageObj === 'string') 
    return imageObj.startsWith('http') ? imageObj : (imageObj.startsWith('/img/') ? `https://inventaire.io${imageObj}` : null);
  if (imageObj.url) 
    return imageObj.url.startsWith('http') ? imageObj.url : `https://inventaire.io${imageObj.url}`;
  if (imageObj.file) 
    return imageObj.file.startsWith('http') ? imageObj.file : (imageObj.file.startsWith('/img/') ? `https://inventaire.io${imageObj.file}` : null);
  return null;
};

/**
 * Resolve an entity from the entities map, handling URI variations
 */
export const resolveInventaireEntity = (entities: Record<string, InventaireEntity>, uri: string): InventaireEntity | null => {
  if (entities[uri]) return entities[uri];
  const stripped = uri.replace(/^wd:/, '');
  const fallbackKey = Object.keys(entities).find(key => key === stripped || key.endsWith(stripped));
  if (fallbackKey) return entities[fallbackKey];
  const firstKey = Object.keys(entities)[0];
  return firstKey ? entities[firstKey] : null;
};

/**
 * Fetch multiple entities from Inventaire.io by their URIs
 */
export const fetchInventaireEntities = async (uris: string[], props?: string): Promise<Record<string, InventaireEntity>> => {
  if (!uris.length) return {};
  const propsParam = props ? `&props=${props}` : '';
  const url = `https://inventaire.io/api/entities/by-uris?uris=${encodeURIComponent(uris.join('|'))}&lang=fr${propsParam}`;
  const response = await fetch(url, { headers: INVENTAIRE_HEADERS });
  if (!response.ok) return {};
  const data = await response.json();
  return data.entities || {};
};

/**
 * Fetch editions for a work from Inventaire.io
 */
export const fetchInventaireEditions = async (workUri: string): Promise<InventaireEdition[]> => {
  try {
    const normalizedUri = normalizeInventaireUri(workUri);
    const url = `https://inventaire.io/api/entities/${encodeURIComponent(normalizedUri)}/editions?lang=fr`;
    const response = await fetch(url, { headers: INVENTAIRE_HEADERS });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.editions) ? data.editions : [];
  } catch {
    return [];
  }
};
