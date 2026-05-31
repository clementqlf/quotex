// Autorise par défaut toutes les origines pour la compatibilité avec l'app mobile (CORS ignoré).
// Pour restreindre l'accès à une web app, configurez la variable ALLOWED_ORIGINS.
const allowedOrigin = Deno.env.get("ALLOWED_ORIGINS") || '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function error(message: string, status = 500): Response {
  return json({ error: message }, status);
}
