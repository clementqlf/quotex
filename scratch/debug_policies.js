const { Client } = require('pg');

async function debug() {
  const devPassword = 'Clementqlf44.Blabla23.';
  const prodPassword = 'Clementqlf44.Blabla23.';

  const devUrl = `postgres://postgres.neurbzkkfxrjzjykthtn:${devPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
  const prodUrl = `postgres://postgres.izrbxjtmwembixwqyaka:${prodPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

  const devClient = new Client({ connectionString: devUrl });
  await devClient.connect();
  const devPolicies = await devClient.query(`
    SELECT tablename, policyname, cmd, roles 
    FROM pg_policies 
    WHERE schemaname = 'public';
  `);
  await devClient.end();

  const prodClient = new Client({ connectionString: prodUrl });
  await prodClient.connect();
  const prodPolicies = await prodClient.query(`
    SELECT tablename, policyname, cmd, roles 
    FROM pg_policies 
    WHERE schemaname = 'public';
  `);
  await prodClient.end();

  console.log(`=== DEV POLICIES (${devPolicies.rows.length}) ===`);
  devPolicies.rows.forEach(p => console.log(`- ${p.tablename}: ${p.policyname} (${p.cmd})`));

  console.log(`\n=== PROD POLICIES (${prodPolicies.rows.length}) ===`);
  prodPolicies.rows.forEach(p => console.log(`- ${p.tablename}: ${p.policyname} (${p.cmd})`));
}

debug().catch(console.error);
