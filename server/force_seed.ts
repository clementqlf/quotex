import { PrismaClient } from '@prisma/client';
import { seed } from './src/seedData';

const prisma = new PrismaClient();

async function forceSeed() {
    console.log('Clearing existing data...');
    // Delete in order to satisfy foreign key constraints
    await prisma.like.deleteMany();
    await prisma.review.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.book.deleteMany();
    await prisma.author.deleteMany();
    await prisma.user.deleteMany();

    console.log('Running seed...');
    await seed();

    console.log('Verification:');
    const authors = await prisma.author.findMany();
    authors.forEach(a => {
        console.log(`- ${a.name}: ${a.birthDate}`);
    });

    await prisma.$disconnect();
}

forceSeed();
