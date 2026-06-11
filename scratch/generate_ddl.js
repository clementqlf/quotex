import { execSync } from 'child_process';

function runQuery(sql) {
  const escapedSql = sql.replace(/'/g, "'\\''");
  const command = `npx supabase db query --linked '${escapedSql}'`;
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(output.substring(start, end + 1));
    }
    throw new Error('No JSON output');
  } catch (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
}

console.log('Introspecting development database schema...');

// Fetch columns
const colRes = runQuery(`
  SELECT 
      table_name, 
      column_name, 
      data_type, 
      is_nullable, 
      column_default,
      character_maximum_length
  FROM 
      information_schema.columns 
  WHERE 
      table_schema = 'public'
  ORDER BY 
      table_name, 
      ordinal_position;
`);

// Fetch constraints
const constRes = runQuery(`
  SELECT
      tc.table_name, 
      tc.constraint_name, 
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
  FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
  WHERE 
      tc.table_schema = 'public';
`);

const columns = colRes.rows || [];
const constraints = constRes.rows || [];

const tables = {};

// Group columns by table
columns.forEach(col => {
  const t = col.table_name;
  if (!tables[t]) {
    tables[t] = { columns: [], pkey: [], fkeys: [], uniques: [] };
  }
  tables[t].columns.push(col);
});

// Group constraints by table
constraints.forEach(con => {
  const t = con.table_name;
  if (!tables[t]) return;
  
  if (con.constraint_type === 'PRIMARY KEY') {
    if (!tables[t].pkey.includes(con.column_name)) {
      tables[t].pkey.push(con.column_name);
    }
  } else if (con.constraint_type === 'FOREIGN KEY') {
    tables[t].fkeys.push(con);
  } else if (con.constraint_type === 'UNIQUE') {
    tables[t].uniques.push(con.column_name);
  }
});

let sqlOutput = '-- Automatically generated schema dump from development database\n\n';

for (const tableName of Object.keys(tables).sort()) {
  if (tableName === '_prisma_migrations') continue;
  
  const table = tables[tableName];
  sqlOutput += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
  
  const colLines = table.columns.map(col => {
    let line = `  "${col.column_name}" `;
    let type = col.data_type.toUpperCase();
    
    if (type === 'USER-DEFINED') {
      // Custom user-defined types (like enums)
      type = 'VARCHAR(255)'; // Fallback to varchar for user-defined
    } else if (col.character_maximum_length) {
      type += `(${col.character_maximum_length})`;
    }
    
    // Postgres type mappings
    if (type === 'CHARACTER VARYING') type = 'VARCHAR';
    
    line += type;
    
    if (col.is_nullable === 'NO') {
      line += ' NOT NULL';
    }
    
    if (col.column_default !== null) {
      line += ` DEFAULT ${col.column_default}`;
    }
    
    return line;
  });
  
  // Add primary key
  if (table.pkey.length > 0) {
    colLines.push(`  CONSTRAINT "${tableName}_pkey" PRIMARY KEY (${table.pkey.map(k => `"${k}"`).join(', ')})`);
  }
  
  sqlOutput += colLines.join(',\n');
  sqlOutput += '\n);\n\n';
}

// Add foreign keys at the end
sqlOutput += '-- Foreign key constraints\n\n';
for (const tableName of Object.keys(tables).sort()) {
  const table = tables[tableName];
  table.fkeys.forEach(con => {
    sqlOutput += `ALTER TABLE "${tableName}" ADD CONSTRAINT "${con.constraint_name}" FOREIGN KEY ("${con.column_name}") REFERENCES "${con.foreign_table_name}" ("${con.foreign_column_name}") ON UPDATE CASCADE ON DELETE CASCADE;\n`;
  });
}

console.log('Generating DDL...');
import fs from 'fs';
fs.writeFileSync('/Users/chantreau/quotex/supabase/migrations/20260608_init_schema.sql', sqlOutput);
console.log('✅ Schema written to supabase/migrations/20260608_init_schema.sql');
