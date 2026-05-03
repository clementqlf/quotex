/**
 * Edge Function: /google-books
 * Handles: GET /google-books/search?q=...
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { searchHybrid } from '../_shared/hybridSearch.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/google-books/, '') || '/';

  try {
    if (req.method === 'GET' && path.startsWith('/search')) {
      const q = url.searchParams.get('q');
      if (!q) return error('Missing query parameter "q"', 400);
      const results = await searchHybrid(q);
      return json(results);
    }
    return error('Not found', 404);
  } catch (e) {
    console.error('[google-books]', e);
    return error('Internal server error');
  }
});
