import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    const authors = await prisma.author.findMany();
    console.log('Authors in database:');
    authors.forEach(a => {
        console.log(`- ${a.name}: ${a.birthDate} (${a.nationality})`);
    });
    await prisma.$disconnect();
}

verify();
