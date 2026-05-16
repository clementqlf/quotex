const postgres = require('postgres');
const connectionString = "postgres://postgres.neurbzkkfxrjzjykthtn:Clementqlf44.Blabla23.@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";
const sql = postgres(connectionString);

async function run() {
  try {
    const bookRows = await sql`SELECT * FROM "Book" LIMIT 1`;
    if (bookRows.length > 0) {
      console.log("Book keys:", Object.keys(bookRows[0]));
    } else {
      console.log("No books found");
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await sql.end();
  }
}

run();
