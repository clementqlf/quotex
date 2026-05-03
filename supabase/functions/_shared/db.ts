// @ts-ignore deno import
import postgres from 'npm:postgres';

// Use DIRECT_URL for Edge Functions (no PgBouncer in session mode)
const connectionString = Deno.env.get('DIRECT_URL') ||
  Deno.env.get('DATABASE_URL') ||
  Deno.env.get('SUPABASE_DB_URL') ||
  '';

// Single shared connection (Edge Functions are stateless, one connection per invocation)
// Single shared connection (Edge Functions are stateless, but we allow a small pool for parallel queries)
export const sql = postgres(connectionString, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: 'require',
});

// ─── Generic query helpers ────────────────────────────────────────────────────

export type DB = typeof sql;

// Helper: upsert UserBook (for library)
export async function upsertUserBook(
  db: DB,
  userId: number,
  bookId: number,
  status?: string
) {
  if (status) {
    await db`
      INSERT INTO "UserBook" ("userId", "bookId", status, "addedAt")
      VALUES (${userId}, ${bookId}, ${status}, now())
      ON CONFLICT ("userId", "bookId") DO UPDATE SET status = EXCLUDED.status
    `;
  } else {
    await db`
      INSERT INTO "UserBook" ("userId", "bookId", "addedAt")
      VALUES (${userId}, ${bookId}, now())
      ON CONFLICT ("userId", "bookId") DO NOTHING
    `;
  }
}
