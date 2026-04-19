
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const authors = await prisma.author.findMany({
    take: 10,
    orderBy: { id: 'desc' }
  });
  console.log('Last 10 authors:');
  console.table(authors.map(a => ({ id: a.id, name: a.name })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
