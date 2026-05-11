/**
 * Edge Function: /book-search (Now using Inventaire)
 * Handles: GET /book-search/search?q=...
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { searchInventaireWorks } from '../_shared/inventaire.api.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/book-search/, '') || '/';

  try {
    if (req.method === 'GET' && path.startsWith('/search')) {
      const q = url.searchParams.get('q');
      if (!q) return error('Missing query parameter "q"', 400);
      
      console.log(`[book-search] Proxying search to Inventaire for: "${q}"`);
      const inventaireResults = await searchInventaireWorks(q, 20);
      
      // Map Inventaire results to the format expected by the frontend
      const mappedResults = inventaireResults.map(r => ({
        googleId: r.uri, 
        inventaireUri: r.uri,
        title: r.label,
        authors: r.authors || [],
        description: '', 
        year: null,
        pages: null,
        cover: r.image || null,
        genre: null,
        isbn: null,
        rating: null,
        buyLink: null,
        price: null
      }));

      return json(mappedResults);
    }
    return error('Not found', 404);
  } catch (e) {
    console.error('[book-search]', e);
    return error('Internal server error');
  }
});
