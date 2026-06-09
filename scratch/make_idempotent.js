import fs from 'fs';

const filePath = '/Users/chantreau/quotex/supabase/migrations/20260609_create_rls_policies.sql';
let content = fs.readFileSync(filePath, 'utf8');

// Regex to find CREATE POLICY
// e.g., CREATE POLICY "Users can view own quotes" ON "Quote" ...
const regex = /CREATE POLICY\s+"([^"]+)"\s+ON\s+"([^"]+)"/g;

let match;
const drops = new Set();
while ((match = regex.exec(content)) !== null) {
  const policyName = match[1];
  const tableName = match[2];
  drops.add(`DROP POLICY IF EXISTS "${policyName}" ON "${tableName}";`);
}

// We want to insert DROP POLICY right before each CREATE POLICY.
// To do this simply, we can replace:
// CREATE POLICY "Name" ON "Table"
// with:
// DROP POLICY IF EXISTS "Name" ON "Table";
// CREATE POLICY "Name" ON "Table"
const newContent = content.replace(/(CREATE POLICY\s+"([^"]+)"\s+ON\s+"([^"]+)")/g, 'DROP POLICY IF EXISTS "$2" ON "$3";\n$1');

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully made migration idempotent!');
