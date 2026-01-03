import { enrichBook } from '../services/bookEnrichment';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    // Create a dummy book if it doesn't exist or use an existing one
    let book = await prisma.book.findFirst({
        where: { title: "Les Misérables" }
    });

    if (!book) {
        // Find an author or create one
        let author = await prisma.author.findFirst();
        if (!author) {
            author = await prisma.author.create({
                data: { name: "Victor Hugo" }
            });
        }
        book = await prisma.book.create({
            data: {
                title: "Les Misérables",
                authorId: author.id
            }
        });
    }

    console.log("Before enrichment:", JSON.stringify(book, null, 2));

    const enriched = await enrichBook(book.id, book.title, "Victor Hugo");

    console.log("After enrichment (returned):", JSON.stringify(enriched, null, 2));

    // Check DB
    const finalBook = await prisma.book.findUnique({
        where: { id: book.id }
    });
    console.log("Final DB state:", JSON.stringify(finalBook, null, 2));
}

test().catch(console.error).finally(() => prisma.$disconnect());
