import postgres from 'npm:postgres';

const sql = postgres('postgres://localhost:5432/db', { dryRun: true });

const updateData = {
  lastEnrichedAt: new Date(),
  isVerified: true,
  enrichmentSource: 'inventaire',
  title: 'Test Title'
};

const query = sql`UPDATE "Book" SET ${sql(updateData)} WHERE id = 123`;
const compiled = query.compile();
console.log("SQL:", compiled[0]);
console.log("ARGS:", compiled[1]);
Deno.exit(0);
