const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);

async function run() {
  try {
    const updatedBooks = await sql`UPDATE "Book" SET "isEnriching" = false WHERE "isEnriching" = true RETURNING id, title`;
    const updatedAuthors = await sql`UPDATE "Author" SET "isEnriching" = false WHERE "isEnriching" = true RETURNING id, name`;
    console.log("Reset books:", updatedBooks);
    console.log("Reset authors:", updatedAuthors);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

run();
