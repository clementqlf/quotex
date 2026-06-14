const { Client } = require('pg');

const devPassword = 'Clementqlf44.Blabla23.';
const devUrl = `postgres://postgres.neurbzkkfxrjzjykthtn:${devPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

async function main() {
  const client = new Client({ connectionString: devUrl });
  await client.connect();
  try {
    const res = await client.query('SELECT id, email, raw_user_meta_data FROM auth.users');
    console.log("=== AUTH USERS ===");
    res.rows.forEach(r => {
      console.log(`ID: ${r.id} | Email: ${r.email} | Meta: ${JSON.stringify(r.raw_user_meta_data)}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

main();
