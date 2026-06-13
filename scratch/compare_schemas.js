const { Client } = require('pg');

async function getSchema(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Fetch columns
    const columnsRes = await client.query(`
      SELECT 
          table_name, 
          column_name, 
          data_type, 
          is_nullable,
          column_default
      FROM 
          information_schema.columns 
      WHERE 
          table_schema = 'public'
      ORDER BY 
          table_name, column_name;
    `);

    // 2. Fetch primary / foreign keys
    const constraintsRes = await client.query(`
      SELECT
          tc.table_name, 
          tc.constraint_name, 
          tc.constraint_type,
          kcu.column_name
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
      WHERE 
          tc.table_schema = 'public'
      ORDER BY
          tc.table_name, tc.constraint_name;
    `);

    return {
      columns: columnsRes.rows,
      constraints: constraintsRes.rows
    };
  } finally {
    await client.end();
  }
}

function compareSchemas(dev, prod) {
  let differencesFound = false;

  console.log('=== COMPARAISON DE SCHÉMAS (DEV vs PROD) ===\n');

  // 1. Compare columns (tables & attributes)
  const devColumnsMap = new Map();
  dev.columns.forEach(col => {
    devColumnsMap.set(`${col.table_name}.${col.column_name}`, col);
  });

  const prodColumnsMap = new Map();
  prod.columns.forEach(col => {
    prodColumnsMap.set(`${col.table_name}.${col.column_name}`, col);
  });

  // Check what is in DEV but missing or different in PROD
  for (const [key, devCol] of devColumnsMap.entries()) {
    if (!prodColumnsMap.has(key)) {
      console.log(`❌ PROD manque la colonne/table : [${devCol.table_name}] -> "${devCol.column_name}"`);
      differencesFound = true;
    } else {
      const prodCol = prodColumnsMap.get(key);
      if (devCol.data_type !== prodCol.data_type || devCol.is_nullable !== prodCol.is_nullable) {
        console.log(`⚠️ Différence de type pour [${devCol.table_name}] -> "${devCol.column_name}" :`);
        console.log(`   DEV  : type=${devCol.data_type}, nullable=${devCol.is_nullable}`);
        console.log(`   PROD : type=${prodCol.data_type}, nullable=${prodCol.is_nullable}`);
        differencesFound = true;
      }
    }
  }

  // Check what is in PROD but missing in DEV
  for (const [key, prodCol] of prodColumnsMap.entries()) {
    if (!devColumnsMap.has(key)) {
      console.log(`❓ PROD possède une colonne/table en trop (absente en DEV) : [${prodCol.table_name}] -> "${prodCol.column_name}"`);
      differencesFound = true;
    }
  }

  // 2. Compare constraints (PK / FK)
  const devConstraintsMap = new Map();
  dev.constraints.forEach(con => {
    devConstraintsMap.set(`${con.table_name}.${con.constraint_name}.${con.column_name}`, con);
  });

  const prodConstraintsMap = new Map();
  prod.constraints.forEach(con => {
    prodConstraintsMap.set(`${con.table_name}.${con.constraint_name}.${con.column_name}`, con);
  });

  for (const [key, devCon] of devConstraintsMap.entries()) {
    if (!prodConstraintsMap.has(key)) {
      console.log(`❌ PROD manque la contrainte : [${devCon.table_name}] -> ${devCon.constraint_type} (${devCon.constraint_name}) sur "${devCon.column_name}"`);
      differencesFound = true;
    }
  }

  for (const [key, prodCon] of prodConstraintsMap.entries()) {
    if (!devConstraintsMap.has(key)) {
      console.log(`❓ PROD possède une contrainte en trop (absente en DEV) : [${prodCon.table_name}] -> ${prodCon.constraint_type} (${prodCon.constraint_name}) sur "${prodCon.column_name}"`);
      differencesFound = true;
    }
  }

  if (!differencesFound) {
    console.log('✅ Succès ! Les schémas de DEV et PROD sont parfaitement identiques.');
  } else {
    console.log('\n❌ Des différences de structure ont été détectées entre DEV et PROD.');
  }
}

async function main() {
  const devPassword = process.env.DEV_PASSWORD;
  const prodPassword = process.env.PROD_PASSWORD;

  if (!devPassword || !prodPassword) {
    console.error('Erreur : Veuillez définir les variables d\'environnement DEV_PASSWORD et PROD_PASSWORD.');
    console.error('Exemple : DEV_PASSWORD=xxx PROD_PASSWORD=yyy node scratch/compare_schemas.js');
    process.exit(1);
  }

  const devUrl = `postgres://postgres.neurbzkkfxrjzjykthtn:${devPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
  const prodUrl = `postgres://postgres.izrbxjtmwembixwqyaka:${prodPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

  console.log('Connexion à la base de DEV...');
  const devSchema = await getSchema(devUrl);
  
  console.log('Connexion à la base de PROD...');
  const prodSchema = await getSchema(prodUrl);

  compareSchemas(devSchema, prodSchema);
}

main().catch(err => {
  console.error('Erreur fatale :', err.message);
});
