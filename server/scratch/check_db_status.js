const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);

async function run() {
  try {
    const books = await sql`SELECT id, title, "isEnriching", "inventaireUri", "authorId" FROM "Book" WHERE title ILIKE '%Capitaine%'`;
    const authors = await sql`SELECT id, name, "isEnriching", "inventaireUri" FROM "Author" WHERE name ILIKE '%Roger%'`;
    console.log("Books:", books);
    console.log("Authors:", authors);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

run();
