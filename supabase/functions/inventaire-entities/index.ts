/**
 * Edge Function: /inventaire-entities
 * Handles: GET /inventaire-entities?uris=uri1|uri2|...
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { getBatchInventaireDetails } from '../_shared/inventaire.api.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== 'GET') return error('Method not allowed', 405);

  const url = new URL(req.url);
  const urisParam = url.searchParams.get('uris');
  if (!urisParam) return error('Missing uris parameter', 400);

  try {
    const uriList = urisParam.split('|');
    const details = await getBatchInventaireDetails(uriList);
    return json(details);
  } catch (e) {
    console.error('[inventaire-entities]', e);
    return error('Internal server error');
  }
});
