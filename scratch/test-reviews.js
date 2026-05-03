const postgres = require('postgres');

const sql = postgres("postgres://postgres.neurbzkkfxrjzjykthtn:Clementqlf44.Blabla23.@aws-0-eu-west-1.pooler.supabase.com:5432/postgres");

async function main() {
    try {
        const bookId = 10;
        const reviews = await sql`
        SELECT r.*, row_to_json(u) as user, row_to_json(b) as book
        FROM "Review" r
        LEFT JOIN "User" u ON u.id = r."userId"
        LEFT JOIN "Book" b ON b.id = r."bookId"
        WHERE r."bookId" = ${bookId}
        ORDER BY r."createdAt" DESC
      `;
        console.log(reviews);
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}
main();
