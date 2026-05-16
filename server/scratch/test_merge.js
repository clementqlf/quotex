const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);

async function mergeBooks(sourceId, targetId) {
  if (sourceId === targetId) return;
  console.log(`[Inventaire] Merging book ${sourceId} → ${targetId}`);
  try {
    await sql.begin(async (tx) => {
      // 1. Move library status
      const userBooks = await tx`SELECT * FROM "UserBook" WHERE "bookId" = ${sourceId}`;
      console.log("Found userBooks to merge:", userBooks);
      for (const ub of userBooks) {
        await tx`
          INSERT INTO "UserBook" ("userId", "bookId", "status", "addedAt")
          VALUES (${ub.userId}, ${targetId}, ${ub.status}, ${ub.addedAt})
          ON CONFLICT ("userId", "bookId") DO UPDATE SET
            "status" = COALESCE("UserBook".status, EXCLUDED.status)
        `;
      }
      // 2. Move relations
      const quotesUpdate = await tx`UPDATE "Quote" SET "bookId" = ${targetId} WHERE "bookId" = ${sourceId} RETURNING *`;
      console.log("Updated quotes:", quotesUpdate);
      // 3. Delete source
      await tx`DELETE FROM "UserBook" WHERE "bookId" = ${sourceId}`;
      await tx`DELETE FROM "Book" WHERE id = ${sourceId}`;
    });
    console.log(`[Inventaire] Merge OK. Book ${sourceId} deleted.`);
  } catch (e) {
    console.error(`[Inventaire] Merge failed ${sourceId}→${targetId}:`, e);
    throw e;
  }
}

async function run() {
  try {
    const testUserId = '3adde20d-a7b2-4a0b-b532-adb8701c4f09';
    
    // Create source author and books
    const authorRows = await sql`INSERT INTO "Author" (name) VALUES ('Test Merge Author') RETURNING id`;
    const authorId = authorRows[0].id;
    
    const sourceBookRows = await sql`INSERT INTO "Book" (title, "authorId") VALUES ('Test Source Book', ${authorId}) RETURNING id`;
    const sourceBookId = sourceBookRows[0].id;
    
    const targetBookRows = await sql`INSERT INTO "Book" (title, "authorId") VALUES ('Test Target Book', ${authorId}) RETURNING id`;
    const targetBookId = targetBookRows[0].id;

    console.log(`Created test books: source=${sourceBookId}, target=${targetBookId}`);

    // Insert user book for source with status READING
    await sql`INSERT INTO "UserBook" ("userId", "bookId", status, "addedAt") VALUES (${testUserId}, ${sourceBookId}, 'READING', now())`;

    // Insert quote for source book
    await sql`INSERT INTO "Quote" (text, "userId", "authorId", "bookId", "likesCount", date) VALUES ('Test Merge Quote', ${testUserId}, ${authorId}, ${sourceBookId}, 0, now())`;

    // Perform merge
    await mergeBooks(sourceBookId, targetBookId);

    // Verify results
    const finalUserBook = await sql`SELECT * FROM "UserBook" WHERE "bookId" = ${targetBookId}`;
    console.log("Final UserBook:", finalUserBook);

    const finalQuote = await sql`SELECT * FROM "Quote" WHERE "bookId" = ${targetBookId}`;
    console.log("Final Quote:", finalQuote);

    // Clean up target and author
    await sql`DELETE FROM "UserBook" WHERE "bookId" = ${targetBookId}`;
    await sql`DELETE FROM "Quote" WHERE "bookId" = ${targetBookId}`;
    await sql`DELETE FROM "Book" WHERE id = ${targetBookId}`;
    await sql`DELETE FROM "Author" WHERE id = ${authorId}`;
    
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await sql.end();
  }
}

run();
