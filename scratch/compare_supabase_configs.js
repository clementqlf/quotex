const { Client } = require('pg');

async function getSupabaseConfig(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  const config = {
    buckets: [],
    secrets: [],
    extensions: [],
    functions: [],
    triggers: [],
    policies: []
  };

  try {
    // 1. Fetch Storage Buckets
    try {
      const bucketsRes = await client.query(`
        SELECT id, name, public FROM storage.buckets ORDER BY id;
      `);
      config.buckets = bucketsRes.rows;
    } catch (e) {
      config.bucketsError = e.message;
    }

    // 2. Fetch Secrets names from Vault (only names, not values for security)
    try {
      const secretsRes = await client.query(`
        SELECT name FROM vault.secrets ORDER BY name;
      `);
      config.secrets = secretsRes.rows;
    } catch (e) {
      config.secretsError = e.message;
    }

    // 3. Fetch Enabled Extensions
    try {
      const extensionsRes = await client.query(`
        SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql') ORDER BY extname;
      `);
      config.extensions = extensionsRes.rows;
    } catch (e) {
      config.extensionsError = e.message;
    }

    // 4. Fetch Custom Functions (routines in public schema)
    try {
      const functionsRes = await client.query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public'
        ORDER BY routine_name;
      `);
      config.functions = functionsRes.rows;
    } catch (e) {
      config.functionsError = e.message;
    }

    // 5. Fetch Custom Triggers
    try {
      const triggersRes = await client.query(`
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
        ORDER BY trigger_name;
      `);
      config.triggers = triggersRes.rows;
    } catch (e) {
      config.triggersError = e.message;
    }

    // 6. Fetch Row Level Security Policies
    try {
      const policiesRes = await client.query(`
        SELECT tablename, policyname, cmd, roles 
        FROM pg_policies 
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
      `);
      config.policies = policiesRes.rows;
    } catch (e) {
      config.policiesError = e.message;
    }

    return config;
  } finally {
    await client.end();
  }
}

function compareConfigs(dev, prod) {
  let differencesFound = false;

  console.log('=== COMPARAISON DES CONFIGURATIONS SUPABASE (DEV vs PROD) ===\n');

  // 1. Compare Storage Buckets
  console.log('--- 📦 Buckets de Stockage ---');
  if (dev.bucketsError || prod.bucketsError) {
    console.log(`⚠️ Impossible de comparer les buckets (Erreur: ${dev.bucketsError || prod.bucketsError})`);
  } else {
    const devBuckets = new Map(dev.buckets.map(b => [b.id, b]));
    const prodBuckets = new Map(prod.buckets.map(b => [b.id, b]));

    for (const [id, devB] of devBuckets.entries()) {
      if (!prodBuckets.has(id)) {
        console.log(`❌ PROD manque le Bucket : "${id}" (public: ${devB.public})`);
        differencesFound = true;
      } else {
        const prodB = prodBuckets.get(id);
        if (devB.public !== prodB.public) {
          console.log(`⚠️ Différence sur le Bucket "${id}" : DEV est public=${devB.public}, PROD est public=${prodB.public}`);
          differencesFound = true;
        }
      }
    }

    for (const id of prodBuckets.keys()) {
      if (!devBuckets.has(id)) {
        console.log(`❓ PROD possède un Bucket en trop : "${id}"`);
        differencesFound = true;
      }
    }
  }
  console.log();

  // 2. Compare Edge Function Secrets (Vault)
  console.log('--- 🔑 Noms des Secrets (Vault / Edge Functions) ---');
  if (dev.secretsError || prod.secretsError) {
    console.log(`⚠️ Impossible de comparer les secrets (Erreur: ${dev.secretsError || prod.secretsError})`);
  } else {
    const devSecrets = new Set(dev.secrets.map(s => s.name));
    const prodSecrets = new Set(prod.secrets.map(s => s.name));

    for (const name of devSecrets) {
      if (!prodSecrets.has(name)) {
        console.log(`❌ PROD manque le Secret : "${name}"`);
        differencesFound = true;
      }
    }

    for (const name of prodSecrets) {
      if (!devSecrets.has(name)) {
        console.log(`❓ PROD possède un Secret en trop : "${name}"`);
        differencesFound = true;
      }
    }
  }
  console.log();

  // 3. Compare Extensions
  console.log('--- 🧩 Extensions PostgreSQL ---');
  if (dev.extensionsError || prod.extensionsError) {
    console.log(`⚠️ Impossible de comparer les extensions`);
  } else {
    const devExts = new Set(dev.extensions.map(e => e.extname));
    const prodExts = new Set(prod.extensions.map(e => e.extname));

    for (const name of devExts) {
      if (!prodExts.has(name)) {
        console.log(`❌ PROD manque l'extension : "${name}"`);
        differencesFound = true;
      }
    }

    for (const name of prodExts) {
      if (!devExts.has(name)) {
        console.log(`❓ PROD possède l'extension en trop : "${name}"`);
        differencesFound = true;
      }
    }
  }
  console.log();

  // 4. Compare Custom Functions
  console.log('--- ⚙️ Fonctions Custom ---');
  if (dev.functionsError || prod.functionsError) {
    console.log(`⚠️ Impossible de comparer les fonctions`);
  } else {
    const devFuncs = new Set(dev.functions.map(f => f.routine_name));
    const prodFuncs = new Set(prod.functions.map(f => f.routine_name));

    for (const name of devFuncs) {
      if (!prodFuncs.has(name)) {
        console.log(`❌ PROD manque la fonction : "${name}()"`);
        differencesFound = true;
      }
    }

    for (const name of prodFuncs) {
      if (!devFuncs.has(name)) {
        console.log(`❓ PROD possède la fonction en trop : "${name}()"`);
        differencesFound = true;
      }
    }
  }
  console.log();

  // 5. Compare Triggers
  console.log('--- ⚡ Triggers ---');
  if (dev.triggersError || prod.triggersError) {
    console.log(`⚠️ Impossible de comparer les triggers`);
  } else {
    const devTrigs = new Set(dev.triggers.map(t => `${t.trigger_name} sur ${t.event_object_table}`));
    const prodTrigs = new Set(prod.triggers.map(t => `${t.trigger_name} sur ${t.event_object_table}`));

    for (const desc of devTrigs) {
      if (!prodTrigs.has(desc)) {
        console.log(`❌ PROD manque le trigger : ${desc}`);
        differencesFound = true;
      }
    }

    for (const desc of prodTrigs) {
      if (!devTrigs.has(desc)) {
        console.log(`❓ PROD possède le trigger en trop : ${desc}`);
        differencesFound = true;
      }
    }
  }
  console.log();

  // 6. Compare RLS Policies
  console.log('--- 🛡️ Politiques RLS (Sécurité) ---');
  if (dev.policiesError || prod.policiesError) {
    console.log(`⚠️ Impossible de comparer les politiques RLS`);
  } else {
    const devPolicies = new Map();
    dev.policies.forEach(p => {
      devPolicies.set(`${p.tablename}.${p.policyname}`, p);
    });

    const prodPolicies = new Map();
    prod.policies.forEach(p => {
      prodPolicies.set(`${p.tablename}.${p.policyname}`, p);
    });

    for (const [key, devP] of devPolicies.entries()) {
      if (!prodPolicies.has(key)) {
        console.log(`❌ PROD manque la politique RLS : [${devP.tablename}] -> "${devP.policyname}" (action: ${devP.cmd})`);
        differencesFound = true;
      } else {
        const prodP = prodPolicies.get(key);
        if (devP.cmd !== prodP.cmd) {
          console.log(`⚠️ Différence sur la politique RLS [${devP.tablename}] -> "${devP.policyname}" : DEV est cmd=${devP.cmd}, PROD est cmd=${prodP.cmd}`);
          differencesFound = true;
        }
      }
    }

    for (const key of prodPolicies.keys()) {
      if (!devPolicies.has(key)) {
        const prodP = prodPolicies.get(key);
        console.log(`❓ PROD possède la politique RLS en trop : [${prodP.tablename}] -> "${prodP.policyname}"`);
        differencesFound = true;
      }
    }
  }
  console.log();

  if (!differencesFound) {
    console.log('✅ Succès ! Les configurations (stockage, secrets, extensions, fonctions, triggers et RLS) sont identiques.');
  } else {
    console.log('❌ Des différences de configuration Supabase ont été détectées.');
  }
}

async function main() {
  const devPassword = process.env.DEV_PASSWORD;
  const prodPassword = process.env.PROD_PASSWORD;

  if (!devPassword || !prodPassword) {
    console.error('Erreur : Veuillez définir les variables d\'environnement DEV_PASSWORD et PROD_PASSWORD.');
    console.error('Exemple : DEV_PASSWORD=xxx PROD_PASSWORD=yyy node scratch/compare_supabase_configs.js');
    process.exit(1);
  }

  const devUrl = `postgres://postgres.neurbzkkfxrjzjykthtn:${devPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
  const prodUrl = `postgres://postgres.izrbxjtmwembixwqyaka:${prodPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

  console.log('Récupération de la configuration de DEV...');
  const devConfig = await getSupabaseConfig(devUrl);
  
  console.log('Récupération de la configuration de PROD...');
  const prodConfig = await getSupabaseConfig(prodUrl);

  compareConfigs(devConfig, prodConfig);
}

main().catch(err => {
  console.error('Erreur fatale :', err.message);
});
