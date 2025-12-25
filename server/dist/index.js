"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const port = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// --- Endpoints ---
// Get all quotes
app.get('/quotes', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('GET /quotes accessed');
        const quotes = yield prisma.quote.findMany({
            include: {
                author: true,
                book: true
            },
            orderBy: { date: 'desc' }
        });
        console.log(`Returning ${quotes.length} quotes`);
        // Transform for client compatibility if needed, or client updates to match
        res.json(quotes);
    }
    catch (e) {
        console.error('Error fetching quotes:', e);
        res.status(500).json({ error: 'Failed to fetch quotes' });
    }
}));
// Get all authors
app.get('/authors', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authors = yield prisma.author.findMany({
            include: { books: true }
        });
        res.json(authors);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch authors' });
    }
}));
// Get all books
app.get('/books', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const books = yield prisma.book.findMany({
            include: { author: true }
        });
        res.json(books);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch books' });
    }
}));
// Create a new quote
app.post('/quotes', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        let authorRecord = yield prisma.author.findUnique({ where: { name: author } });
        if (!authorRecord) {
            authorRecord = yield prisma.author.create({ data: { name: author } });
        }
        // 2. Find or Create Book
        let bookRecord = yield prisma.book.findUnique({ where: { title: book } });
        if (!bookRecord) {
            bookRecord = yield prisma.book.create({
                data: {
                    title: book,
                    authorId: authorRecord.id
                }
            });
        }
        // 3. Create Quote
        const newQuote = yield prisma.quote.create({
            data: {
                text,
                date: new Date(),
                authorId: authorRecord.id,
                bookId: bookRecord.id
            },
            include: {
                author: true,
                book: true
            }
        });
        console.log('Created quote:', newQuote.id);
        res.json(newQuote);
    }
    catch (e) {
        console.error('Error creating quote:', e);
        res.status(500).json({ error: 'Failed to create quote' });
    }
}));
// Delete a quote
app.delete('/quotes/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma.quote.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true });
    }
    catch (e) {
        console.error('Error deleting quote:', e);
        res.status(500).json({ error: 'Failed to delete quote' });
    }
}));
// --- Seeding ---
function seedIfNeeded() {
    return __awaiter(this, void 0, void 0, function* () {
        const count = yield prisma.author.count();
        if (count === 0) {
            console.log('Seeding initial data...');
            // Authors
            const steveJobs = yield prisma.author.create({
                data: {
                    name: "Steve Jobs",
                    description: "Co-founder of Apple Inc.",
                    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop",
                    nationality: "American"
                }
            });
            const einstein = yield prisma.author.create({
                data: {
                    name: "Albert Einstein",
                    description: "Theoretical physicist.",
                    image: "https://images.unsplash.com/photo-1541560052-77ec1bbc09f7?w=400&h=400&fit=crop",
                    nationality: "German"
                }
            });
            const jkr = yield prisma.author.create({
                data: {
                    name: "J.K. Rowling",
                    description: "Author of Harry Potter.",
                    image: "https://images.unsplash.com/photo-1611601322175-8759d8e33441?w=400&h=400&fit=crop",
                    nationality: "British"
                }
            });
            // Books
            const bioJobs = yield prisma.book.create({
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
            const bioEinstein = yield prisma.book.create({
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
            const hp2 = yield prisma.book.create({
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
            yield prisma.quote.createMany({
                data: [
                    {
                        text: "The only way to do great work is to love what you do.",
                        authorId: steveJobs.id,
                        bookId: bioJobs.id,
                        likes: 12,
                        isLiked: true
                    },
                    {
                        text: "In the middle of difficulty lies opportunity.",
                        authorId: einstein.id,
                        bookId: bioEinstein.id,
                        likes: 8
                    },
                    {
                        text: "It is our choices that show what we truly are, far more than our abilities.",
                        authorId: jkr.id,
                        bookId: hp2.id,
                        likes: 24,
                        isLiked: true
                    }
                ]
            });
            console.log('Seeded database.');
        }
    });
}
app.listen(port, () => __awaiter(void 0, void 0, void 0, function* () {
    yield seedIfNeeded();
    console.log(`Server running at http://localhost:${port}`);
}));
