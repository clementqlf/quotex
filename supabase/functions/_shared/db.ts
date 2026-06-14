// @ts-ignore deno import
import postgres from 'npm:postgres';

// Use DATABASE_URL (Transaction Mode) for Edge Functions to allow more concurrent isolates.
// We keep max: 1 to ensure each isolate uses exactly one connection, allowing up to 15-20 concurrent isolates.
const connectionString = Deno.env.get('DATABASE_URL') ||
  Deno.env.get('DIRECT_URL') ||
  Deno.env.get('SUPABASE_DB_URL') ||
  '';

export const sql = postgres(connectionString, {
  max: 1,
  idle_timeout: 10,
  connect_timeout: 10,
  ssl: 'require',
  connection: {
    client_min_messages: 'warning',
  },
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
        INSERT INTO "UserBook" ("userId", "bookId", "status", "addedAt")
        VALUES (${userId}, ${bookId}, ${status}, now())
        ON CONFLICT ("userId", "bookId") DO UPDATE SET "status" = EXCLUDED.status
      `;
  } else {
    await db`
      INSERT INTO "UserBook" ("userId", "bookId", "addedAt")
      VALUES (${userId}, ${bookId}, now())
      ON CONFLICT ("userId", "bookId") DO NOTHING
    `;
  }
}
