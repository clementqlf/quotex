import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Endpoints ---

// Get all quotes
app.get('/quotes', async (req, res) => {
    try {
        console.log('GET /quotes accessed');
        const quotes = await prisma.quote.findMany({
            include: {
                author: true,
                book: true,
                user: true
            },
            orderBy: { date: 'desc' }
        });
        console.log(`Returning ${quotes.length} quotes`);
        // Transform for client compatibility if needed, or client updates to match
        res.json(quotes);
    } catch (e) {
        console.error('Error fetching quotes:', e);
        res.status(500).json({ error: 'Failed to fetch quotes' });
    }
});

// Get all authors
app.get('/authors', async (req, res) => {
    try {
        const authors = await prisma.author.findMany({
            include: { books: true }
        });
        res.json(authors);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch authors' });
    }
});

// Get all books
app.get('/books', async (req, res) => {
    try {
        const books = await prisma.book.findMany({
            include: { author: true }
        });
        res.json(books);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

// Create a new quote
app.post('/quotes', async (req, res) => {
    try {
        // Expecting { text, author: string, book: string } from client for simplicity,
        // or { text, authorId, bookId } if client is advanced.
        // For this task, let's handle "find or create" based on names to keep client simple for now.
        const { text, author, book } = req.body;
        console.log('POST /quotes received:', { text, author, book });

        if (!text || !author || !book) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // 1. Find or Create Author
        let authorRecord = await prisma.author.findUnique({ where: { name: author } });
        if (!authorRecord) {
            authorRecord = await prisma.author.create({ data: { name: author } });
        }

        // 2. Find or Create Book
        let bookRecord = await prisma.book.findUnique({ where: { title: book } });
        if (!bookRecord) {
            bookRecord = await prisma.book.create({
                data: {
                    title: book,
                    authorId: authorRecord.id
                }
            });
        }

        // 3. Create Quote
        const newQuote = await prisma.quote.create({
            data: {
                text,
                date: new Date(),
                authorId: authorRecord.id,
                bookId: bookRecord.id,
                userId: 1 // Hardcoded to default user for now
            },
            include: {
                author: true,
                book: true,
                user: true
            }
        });

        console.log('Created quote:', newQuote.id);
        res.json(newQuote);
    } catch (e) {
        console.error('Error creating quote:', e);
        res.status(500).json({ error: 'Failed to create quote' });
    }
});

// Delete a quote
app.delete('/quotes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.quote.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting quote:', e);
        res.status(500).json({ error: 'Failed to delete quote' });
    }
});

// --- Seeding ---

async function seedIfNeeded() {
    const count = await prisma.author.count();
    if (count === 0) {
        console.log('Seeding initial data...');

        // Users
        const user1 = await prisma.user.create({
            data: {
                username: "@clementqlf",
                name: "Clément QLF",
                image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop"
            }
        });
        const user2 = await prisma.user.create({
            data: {
                username: "@sophiereads",
                name: "Sophie Martin",
                image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop"
            }
        });

        // Authors
        const steveJobs = await prisma.author.create({
            data: {
                name: "Steve Jobs",
                description: "Co-founder of Apple Inc.",
                image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop",
                nationality: "American"
            }
        });

        const einstein = await prisma.author.create({
            data: {
                name: "Albert Einstein",
                description: "Theoretical physicist.",
                image: "https://images.unsplash.com/photo-1541560052-77ec1bbc09f7?w=400&h=400&fit=crop",
                nationality: "German"
            }
        });

        const jkr = await prisma.author.create({
            data: {
                name: "J.K. Rowling",
                description: "Author of Harry Potter.",
                image: "https://images.unsplash.com/photo-1611601322175-8759d8e33441?w=400&h=400&fit=crop",
                nationality: "British"
            }
        });

        // Books
        const bioJobs = await prisma.book.create({
            data: {
                title: "Steve Jobs",
                authorId: steveJobs.id,
                year: 2011,
                pages: 656,
                cover: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=600&fit=crop",
                genre: "Biography",
                rating: 4.7
            }
        });

        const bioEinstein = await prisma.book.create({
            data: {
                title: "Einstein: His Life and Universe",
                authorId: einstein.id,
                year: 2007,
                pages: 704,
                cover: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=600&fit=crop",
                genre: "Biography",
                rating: 4.6
            }
        });

        const hp2 = await prisma.book.create({
            data: {
                title: "Harry Potter and the Chamber of Secrets",
                authorId: jkr.id,
                year: 1998,
                pages: 341,
                cover: "https://images.unsplash.com/photo-1551029506-0807df4e2031?w=400&h=600&fit=crop",
                genre: "Fantasy",
                rating: 4.8
            }
        });

        // Quotes
        await prisma.quote.createMany({
            data: [
                {
                    text: "The only way to do great work is to love what you do.",
                    authorId: steveJobs.id,
                    bookId: bioJobs.id,
                    userId: user1.id,
                    likes: 12,
                    isLiked: true
                },
                {
                    text: "In the middle of difficulty lies opportunity.",
                    authorId: einstein.id,
                    bookId: bioEinstein.id,
                    userId: user2.id,
                    likes: 8
                },
                {
                    text: "It is our choices that show what we truly are, far more than our abilities.",
                    authorId: jkr.id,
                    bookId: hp2.id,
                    userId: user1.id,
                    likes: 24,
                    isLiked: true
                }
            ]
        });

        console.log('Seeded database.');
    }
}

app.listen(port, async () => {
    await seedIfNeeded();
    console.log(`Server running at http://localhost:${port}`);
});
