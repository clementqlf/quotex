const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const devPassword = 'Clementqlf44.Blabla23.';
const prodPassword = 'Clementqlf44.Blabla23.';

const devUrl = `postgres://postgres.neurbzkkfxrjzjykthtn:${devPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
const prodUrl = `postgres://postgres.izrbxjtmwembixwqyaka:${prodPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

// Paths to migration files
const migration3 = path.join(__dirname, '../supabase/migrations/20260614000003_enable_supabase_realtime_publications.sql');
const migration4 = path.join(__dirname, '../supabase/migrations/20260614000004_enable_missing_rls.sql');

async function executeMigration(url, envName, sqlFile) {
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    console.log(`Executing ${path.basename(sqlFile)} on ${envName}...`);
    await client.query(sql);
    console.log(`✅ Success for ${envName}`);
  } catch (error) {
    console.error(`❌ Error executing migration on ${envName}:`, error.message);
  } finally {
    await client.end();
  }
}

async function getRLSPolicies(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT tablename, policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    return res.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('--- 🔄 APPLYING MIGRATIONS TO DEV AND PROD ---');
  
  // 1. Run Migration 3 (Realtime)
  await executeMigration(devUrl, 'DEV', migration3);
  await executeMigration(prodUrl, 'PROD', migration3);
  
  // 2. Run Migration 4 (RLS)
  await executeMigration(devUrl, 'DEV', migration4);
  await executeMigration(prodUrl, 'PROD', migration4);

  console.log('\n--- 📊 VERIFYING POLICIES AFTER MIGRATIONS ---');
  const devPolicies = await getRLSPolicies(devUrl);
  const prodPolicies = await getRLSPolicies(prodUrl);

  const devMap = new Set(devPolicies.map(p => `${p.tablename}.${p.policyname}`));
  const prodMap = new Set(prodPolicies.map(p => `${p.tablename}.${p.policyname}`));
  const allPolicyKeys = Array.from(new Set([...devMap, ...prodMap])).sort();

  console.log(`\nDev has ${devPolicies.length} policies.`);
  console.log(`Prod has ${prodPolicies.length} policies.`);

  let inSync = true;
  allPolicyKeys.forEach(key => {
    const hasDev = devMap.has(key);
    const hasProd = prodMap.has(key);
    if (!hasDev || !hasProd) {
      inSync = false;
      console.log(`⚠️ Mismatch: ${key} | Dev: ${hasDev ? 'Yes' : 'No'} | Prod: ${hasProd ? 'Yes' : 'No'}`);
    }
  });

  if (inSync) {
    console.log('\n🎉 SUCCESS: RLS policies on Dev and Prod are perfectly identical and in sync!');
  } else {
    console.log('\n❌ RLS policies are still not in sync.');
  }
}

main().catch(console.error);
