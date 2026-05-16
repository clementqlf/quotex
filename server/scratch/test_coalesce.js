const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);

async function run() {
  try {
    const testUserId = '3adde20d-a7b2-4a0b-b532-adb8701c4f09';
    const testBookId = 1202;
    
    // 1. Clean up
    await sql`DELETE FROM "UserBook" WHERE "userId" = ${testUserId} AND "bookId" = ${testBookId}`;

    // 2. Insert with NULL status (simulating saved book without reading status)
    await sql`
      INSERT INTO "UserBook" ("userId", "bookId", status, "addedAt")
      VALUES (${testUserId}, ${testBookId}, null, now())
    `;
    let row = await sql`SELECT * FROM "UserBook" WHERE "userId" = ${testUserId} AND "bookId" = ${testBookId}`;
    console.log("Initial state:", row[0]);

    // 3. Try to add quote (which runs the ON CONFLICT query)
    await sql`
      INSERT INTO "UserBook" ("userId", "bookId", status, "addedAt")
      VALUES (${testUserId}, ${testBookId}, 'READING', now())
      ON CONFLICT ("userId", "bookId") 
      DO UPDATE SET status = COALESCE("UserBook".status, EXCLUDED.status)
    `;

    row = await sql`SELECT * FROM "UserBook" WHERE "userId" = ${testUserId} AND "bookId" = ${testBookId}`;
    console.log("State after conflict with NULL status:", row[0]);

    // 4. Try again when it is already 'READING'
    await sql`
      INSERT INTO "UserBook" ("userId", "bookId", status, "addedAt")
      VALUES (${testUserId}, ${testBookId}, 'READING', now())
      ON CONFLICT ("userId", "bookId") 
      DO UPDATE SET status = COALESCE("UserBook".status, EXCLUDED.status)
    `;
    row = await sql`SELECT * FROM "UserBook" WHERE "userId" = ${testUserId} AND "bookId" = ${testBookId}`;
    console.log("State after conflict with 'READING' status:", row[0]);

    // 5. Clean up
    await sql`DELETE FROM "UserBook" WHERE "userId" = ${testUserId} AND "bookId" = ${testBookId}`;
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

run();
