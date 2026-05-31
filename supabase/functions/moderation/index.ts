// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { requireAuth } from '../_shared/auth.ts';

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^(?:\/functions\/v1)?\/moderation/, '') || '/';
  
  try {
    const authUser = await requireAuth(req);
    if (authUser instanceof Response) return authUser;

    // POST /moderation/blocks
    if (req.method === 'POST' && path === '/blocks') {
      const { blockedId } = await req.json();
      if (!blockedId) return error('Missing blockedId', 400);

      await sql`
        INSERT INTO "UserBlock" ("blockerId", "blockedId", "createdAt")
        VALUES (${authUser.id}, ${blockedId}, now())
        ON CONFLICT ("blockerId", "blockedId") DO NOTHING
      `;
      return json({ success: true });
    }

    // POST /moderation/reports
    if (req.method === 'POST' && path === '/reports') {
      const { reviewId, reason } = await req.json();
      if (!reviewId || !reason) return error('Missing reviewId or reason', 400);

      await sql`
        INSERT INTO "Report" ("reporterId", "reviewId", "reason", "createdAt")
        VALUES (${authUser.id}, ${reviewId}, ${reason}, now())
        ON CONFLICT ("reporterId", "reviewId") DO NOTHING
      `;
      return json({ success: true });
    }

    // GET /moderation/sync
    if (req.method === 'GET' && path === '/sync') {
      const blocks = await sql`SELECT "blockedId" FROM "UserBlock" WHERE "blockerId" = ${authUser.id}`;
      const reports = await sql`SELECT "reviewId" FROM "Report" WHERE "reporterId" = ${authUser.id}`;

      return json({
        blockedIds: blocks.map(b => b.blockedId),
        reportedReviewIds: reports.map(r => String(r.reviewId))
      });
    }

    // GET /moderation/forbidden-words
    if (req.method === 'GET' && path === '/forbidden-words') {
      const words = await sql`SELECT "word" FROM "ForbiddenWord" ORDER BY "word" ASC`;
      return json({
        words: words.map(w => w.word)
      });
    }

    return error('Method not allowed or endpoint not found', 405);
  } catch (e: any) {
    console.error('[moderation]', e);
    return error(`Internal server error: ${e.message || 'Unknown error'}`);
  }
});
