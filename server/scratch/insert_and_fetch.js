const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);

async function run() {
  try {
    // Insert test user book row
    const testUserId = '3adde20d-a7b2-4a0b-b532-adb8701c4f09';
    const testBookId = 1202;
    
    // Clean up first if any
    await sql`DELETE FROM "UserBook" WHERE "userId" = ${testUserId} AND "bookId" = ${testBookId}`;

    await sql`
      INSERT INTO "UserBook" ("userId", "bookId", status, "addedAt")
      VALUES (${testUserId}, ${testBookId}, 'READING', now())
    `;

    const rows = await sql`SELECT * FROM "UserBook" WHERE "userId" = ${testUserId} AND "bookId" = ${testBookId}`;
    console.log("Returned row:", rows[0]);
    console.log("Row keys:", Object.keys(rows[0]));

    // Clean up
    await sql`DELETE FROM "UserBook" WHERE "userId" = ${testUserId} AND "bookId" = ${testBookId}`;
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

run();
