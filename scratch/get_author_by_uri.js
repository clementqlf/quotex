import postgres from 'npm:postgres';

const connectionString = 'postgresql://postgres:postgres@localhost:54322/postgres'; // local Supabase DB fallback

async function check() {
  const sql = postgres(connectionString);
  try {
    const authors = await sql`SELECT * FROM "Author" WHERE "inventaireUri" = 'wd:Q19074'`;
    console.log("Authors with URI wd:Q19074:", JSON.stringify(authors, null, 2));
    
    const all = await sql`SELECT id, name, "inventaireUri" FROM "Author" ORDER BY id DESC LIMIT 20`;
    console.log("Latest Authors:", JSON.stringify(all, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
check();
