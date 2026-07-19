import { sql } from "../supabase/functions/_shared/db.ts";

console.log("=== CHECKING BOOKS IN DATABASE ===");
try {
  const books = await sql`
    SELECT id, title, cover, "inventaireUri", "isEnriching", "lastEnrichedAt"
    FROM "Book"
    ORDER BY id DESC
    LIMIT 20
  `;
  console.log(JSON.stringify(books, null, 2));
} catch (e) {
  console.error("Database query failed:", e);
}
