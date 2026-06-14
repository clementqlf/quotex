const { Client } = require('pg');

async function getRLSStatus(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT schemaname, tablename, rowsecurity
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    return res.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  const devPassword = 'Clementqlf44.Blabla23.';
  const prodPassword = 'Clementqlf44.Blabla23.';

  const devUrl = `postgres://postgres.neurbzkkfxrjzjykthtn:${devPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
  const prodUrl = `postgres://postgres.izrbxjtmwembixwqyaka:${prodPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

  console.log('Fetching RLS status for DEV...');
  const devTables = await getRLSStatus(devUrl);

  console.log('Fetching RLS status for PROD...');
  const prodTables = await getRLSStatus(prodUrl);

  console.log('\n📊 RLS Status Comparison (DEV vs PROD):\n');
  
  const devMap = new Map(devTables.map(t => [t.tablename, t.rowsecurity]));
  const prodMap = new Map(prodTables.map(t => [t.tablename, t.rowsecurity]));
  const allTables = Array.from(new Set([...devMap.keys(), ...prodMap.keys()])).sort();

  const comparison = allTables.map(name => {
    const devRls = devMap.get(name);
    const prodRls = prodMap.get(name);
    return {
      Table: name,
      'Dev RLS': devRls ? '🔒 Enabled' : '🔓 Disabled (UNRESTRICTED)',
      'Prod RLS': prodRls ? '🔒 Enabled' : '🔓 Disabled (UNRESTRICTED)',
      Match: devRls === prodRls ? '✅ Match' : '❌ Mismatch'
    };
  });

  console.table(comparison);
}

main().catch(console.error);
