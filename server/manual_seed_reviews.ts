
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding reviews manually...');

    // Get "Dune" book
    const book = await prisma.book.findFirst({ where: { title: 'Dune' } });
    if (!book) {
        console.error('Book "Dune" not found! Run base seed first.');
        return;
    }

    // Get User "sophiereads"
    const user = await prisma.user.findUnique({ where: { username: 'sophiereads' } });
    if (!user) {
        console.error('User "sophiereads" not found!');
        return;
    }

    // Create Review
    await prisma.review.create({
        data: {
            bookId: book.id,
            userId: user.id,
            rating: 5,
            comment: "Manually seeded review: A masterpiece!",
            createdAt: new Date()
        }
    });

    console.log('Manual review seeded successfully.');
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
