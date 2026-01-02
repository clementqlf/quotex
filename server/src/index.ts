import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { seed } from './seedData';

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Endpoints ---

// Get all quotes
// Get all quotes
app.get('/quotes', async (req, res) => {
    try {
        console.log('GET /quotes accessed');
        const userId = 1; // Assuming default user for now

        const quotes = await prisma.quote.findMany({
            include: {
                author: true,
                book: true,
                user: true,
                likes: {
                    where: { userId: userId }
                },
                _count: {
                    select: { likes: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        const quotesWithLikeStatus = quotes.map(quote => ({
            ...quote,
            isLiked: quote.likes.length > 0,
            likesCount: quote._count.likes // Use the real relation count
        }));

        console.log(`Returning ${quotesWithLikeStatus.length} quotes`);
        res.json(quotesWithLikeStatus);
    } catch (e) {
        console.error('Error fetching quotes:', e);
        res.status(500).json({ error: 'Failed to fetch quotes' });
    }
});

// Get single quote by ID
app.get('/quotes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = 1; // Assuming default user for now

        const quote = await prisma.quote.findUnique({
            where: { id: parseInt(id) },
            include: {
                author: true,
                book: true,
                user: true,
                likes: {
                    where: { userId: userId }
                },
                _count: {
                    select: { likes: true }
                }
            }
        });

        if (!quote) {
            res.status(404).json({ error: 'Quote not found' });
            return;
        }

        const quoteWithLikeStatus = {
            ...quote,
            isLiked: quote.likes.length > 0,
            likesCount: quote._count.likes
        };

        res.json(quoteWithLikeStatus);
    } catch (e) {
        console.error('Error fetching quote:', e);
        res.status(500).json({ error: 'Failed to fetch quote' });
    }
});

// Toggle like on a quote
app.post('/quotes/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = 1; // Hardcoded user for now
        const quoteId = parseInt(id);

        const existingLike = await prisma.like.findUnique({
            where: {
                userId_quoteId: {
                    userId,
                    quoteId
                }
            }
        });

        if (existingLike) {
            // Unlike
            await prisma.like.delete({
                where: {
                    id: existingLike.id
                }
            });
            await prisma.quote.update({
                where: { id: quoteId },
                data: { likesCount: { decrement: 1 } }
            });
            res.json({ isLiked: false });
        } else {
            // Like
            await prisma.like.create({
                data: {
                    userId,
                    quoteId
                }
            });
            await prisma.quote.update({
                where: { id: quoteId },
                data: { likesCount: { increment: 1 } }
            });
            res.json({ isLiked: true });
        }
    } catch (e) {
        console.error('Error toggling like:', e);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

// Get all authors
app.get('/authors', async (req, res) => {
    try {
        const authors = await prisma.author.findMany({
            include: {
                books: true,
                similarAuthors: true
            }
        });
        res.json(authors);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch authors' });
    }
});

// Get all books
app.get('/books', async (req, res) => {
    try {
        console.log(`[Server] GET /books accessed`);
        const books = await prisma.book.findMany({
            include: {
                author: true,
                similarBooks: true
            }
        });
        if (books.length > 0) {
            console.log(`[Server] Returning ${books.length} books. Sample rating: ${books[0].title} = ${books[0].rating}`);
        }
        res.json(books);
    } catch (e) {
        console.error('Error fetching books:', e);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

// Get user by username
app.get('/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        // Handle @ prefix
        const cleanUsername = username.startsWith('@') ? username : `@${username}`;

        const user = await prisma.user.findUnique({
            where: { username: cleanUsername },
            include: {
                quotes: {
                    include: {
                        book: true,
                        author: true
                    }
                }
            }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    } catch (e) {
        console.error("Error fetching user", e);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Create a new quote
app.post('/quotes', async (req, res) => {
    try {
        // Expecting { text, author: string, book: string } from client for simplicity,
        // or { text, authorId, bookId } if client is advanced.
        // For this task, let's handle "find or create" based on names to keep client simple for now.
        const { text, author, book, theme } = req.body;
        console.log('POST /quotes received:', { text, author, book, theme });

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

                userId: 1, // Hardcoded to default user for now
                theme,
                likesCount: 0
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


// --- Reviews ---

// Create a new review
// Create a new review
app.post('/reviews', async (req, res) => {
    try {
        const { rating, comment, bookId, userId } = req.body;

        if (!rating || !bookId || !userId) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const newReview = await prisma.review.create({
            data: {
                rating,
                comment,
                bookId,
                userId,
                createdAt: new Date()
            },
            include: {
                user: true,
                book: true
            }
        });

        // Calculate new average rating
        const aggregations = await prisma.review.aggregate({
            _avg: {
                rating: true
            },
            where: {
                bookId: bookId
            }
        });

        const newAverageRating = aggregations._avg.rating || rating;

        // Update book with new rating
        await prisma.book.update({
            where: { id: bookId },
            data: { rating: newAverageRating }
        });

        res.json(newReview);
    } catch (e) {
        console.error('Error creating review:', e);
        res.status(500).json({ error: 'Failed to create review' });
    }
});

// Get reviews for a book
app.get('/reviews', async (req, res) => {
    try {
        const { bookId } = req.query;
        if (!bookId) {
            res.status(400).json({ error: 'Missing bookId query parameter' });
            return;
        }

        const parsedBookId = parseInt(bookId as string);
        if (isNaN(parsedBookId)) {
            res.status(400).json({ error: 'Invalid bookId: must be a number' });
            return;
        }

        const reviews = await prisma.review.findMany({
            where: { bookId: parsedBookId },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json(reviews);
    } catch (e) {
        console.error('Error fetching reviews:', e);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// --- Search ---

app.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            res.status(400).json({ error: 'Missing or invalid query parameter "q"' });
            return;
        }

        const query = q.toLowerCase();
        console.log(`[Server] Search query: "${query}"`);

        // 1. Search Quotes (text or theme)
        const quotes = await prisma.quote.findMany({
            where: {
                OR: [
                    { text: { contains: query } }, // removed mode: 'insensitive' for compatibility if sqlite
                    { theme: { contains: query } }
                ]
            },
            include: {
                author: true,
                book: true,
                user: true,
                _count: { select: { likes: true } }
            },
            take: 20
        });

        // 2. Search Authors
        const authors = await prisma.author.findMany({
            where: {
                name: { contains: query }
            },
            take: 10
        });

        // 3. Search Books
        const books = await prisma.book.findMany({
            where: {
                title: { contains: query }
            },
            include: { author: true },
            take: 10
        });

        // 4. Search Themes (Derived from Quotes)
        // Since we don't have a separate Theme model, we find unique themes from quotes matching the query
        // But the user probably wants to search *for* a theme.
        // We already searched quotes by theme.
        // Let's also just find distinct themes that contain the query string.
        const themesRaw = await prisma.quote.findMany({
            where: {
                theme: { contains: query }
            },
            select: { theme: true },
            distinct: ['theme'],
            take: 10
        });
        const themes = themesRaw.map(t => t.theme).filter(t => t !== null);

        // Process quotes to include proper like counts and structure
        const formattedQuotes = quotes.map(quote => ({
            ...quote,
            isLiked: false, // User context needed for real state, defaulting to false for search result list
            likesCount: quote._count.likes
        }));

        res.json({
            quotes: formattedQuotes,
            authors,
            books,
            themes
        });

    } catch (e) {
        console.error('Error performing search:', e);
        res.status(500).json({ error: 'Failed to perform search' });
    }
});

// --- Seeding ---

async function seedIfNeeded() {
    const count = await prisma.user.count(); // Check users instead of authors, or just quote table
    if (count === 0) {
        await seed();
    }
}

app.listen(port, async () => {
    await seedIfNeeded();
    console.log(`Server running at http://localhost:${port}`);
});
