const { Client } = require('pg');

async function main() {
  const devPassword = process.env.DEV_PASSWORD || 'Clementqlf44.Blabla23.';
  const devUrl = `postgres://postgres.neurbzkkfxrjzjykthtn:${devPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

  const client = new Client({ connectionString: devUrl });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
        AND p.proname IN ('handle_new_user', 'update_book_rating', 'unicode_translate');
    `);

    for (const row of res.rows) {
      console.log(`\n-- === FUNCTION: ${row.proname} ===`);
      console.log(row.definition);
      console.log(';');
    }

    // Also get the trigger definition for Review
    const triggerRes = await client.query(`
      SELECT pg_get_triggerdef(t.oid) as definition
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND t.tgname = 'trg_update_book_rating';
    `);

    for (const row of triggerRes.rows) {
      console.log(`\n-- === TRIGGER: trg_update_book_rating ===`);
      console.log(row.definition);
      console.log(';');
    }

    // Also get any triggers on auth.users for handle_new_user
    const authTriggerRes = await client.query(`
      SELECT pg_get_triggerdef(t.oid) as definition
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'auth' AND t.tgfoid = 'public.handle_new_user'::regproc;
    `);

    for (const row of authTriggerRes.rows) {
      console.log(`\n-- === AUTH TRIGGER: ===`);
      console.log(row.definition);
      console.log(';');
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
