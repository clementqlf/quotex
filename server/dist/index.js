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
const seedData_1 = require("./seedData");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const port = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Helper to format book (parse JSON fields)
const formatBook = (book) => {
    if (!book)
        return null;
    return Object.assign(Object.assign({}, book), { buyLinks: book.buyLinks && typeof book.buyLinks === 'string' ? JSON.parse(book.buyLinks) : [] });
};
// Helper to format quote (including nested book)
const formatQuote = (quote) => {
    return Object.assign(Object.assign({}, quote), { book: quote.book ? formatBook(quote.book) : null, isLiked: quote.likes ? quote.likes.length > 0 : false, likesCount: quote._count ? quote._count.likes : quote.likesCount });
};
// --- Endpoints ---
// Get all quotes
app.get('/quotes', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('GET /quotes accessed');
        const userId = 1; // Assuming default user for now
        const quotes = yield prisma.quote.findMany({
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
        const quotesWithLikeStatus = quotes.map(formatQuote);
        console.log(`Returning ${quotesWithLikeStatus.length} quotes`);
        res.json(quotesWithLikeStatus);
    }
    catch (e) {
        console.error('Error fetching quotes:', e);
        res.status(500).json({ error: 'Failed to fetch quotes' });
    }
}));
// Get single quote by ID
app.get('/quotes/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = 1; // Assuming default user for now
        const quote = yield prisma.quote.findUnique({
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
        const quoteWithLikeStatus = formatQuote(quote);
        res.json(quoteWithLikeStatus);
    }
    catch (e) {
        console.error('Error fetching quote:', e);
        res.status(500).json({ error: 'Failed to fetch quote' });
    }
}));
// Toggle like on a quote
app.post('/quotes/:id/like', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = 1; // Hardcoded user for now
        const quoteId = parseInt(id);
        const existingLike = yield prisma.like.findUnique({
            where: {
                userId_quoteId: {
                    userId,
                    quoteId
                }
            }
        });
        if (existingLike) {
            // Unlike
            yield prisma.like.delete({
                where: {
                    id: existingLike.id
                }
            });
            yield prisma.quote.update({
                where: { id: quoteId },
                data: { likesCount: { decrement: 1 } }
            });
            res.json({ isLiked: false });
        }
        else {
            // Like
            yield prisma.like.create({
                data: {
                    userId,
                    quoteId
                }
            });
            yield prisma.quote.update({
                where: { id: quoteId },
                data: { likesCount: { increment: 1 } }
            });
            res.json({ isLiked: true });
        }
    }
    catch (e) {
        console.error('Error toggling like:', e);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
}));
// Get all authors
app.get('/authors', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authors = yield prisma.author.findMany({
            include: {
                books: true,
                similarAuthors: true
            }
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
        console.log(`[Server] GET /books accessed`);
        const books = yield prisma.book.findMany({
            include: {
                author: true,
                similarBooks: true
            }
        });
        if (books.length > 0) {
            console.log(`[Server] Returning ${books.length} books. Sample rating: ${books[0].title} = ${books[0].rating}`);
        }
        const formattedBooks = books.map(formatBook);
        res.json(formattedBooks);
    }
    catch (e) {
        console.error('Error fetching books:', e);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
}));
// Get user by username
app.get('/users/:username', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username } = req.params;
        // Handle @ prefix
        const cleanUsername = username.startsWith('@') ? username : `@${username}`;
        const user = yield prisma.user.findUnique({
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
        const formattedUser = Object.assign(Object.assign({}, user), { quotes: user.quotes.map((q) => formatQuote(Object.assign(Object.assign({}, q), { user }))) // optimizing to not re-fetch user
         });
        res.json(formattedUser);
    }
    catch (e) {
        console.error("Error fetching user", e);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
}));
// Create a new quote
app.post('/quotes', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        res.json(formatQuote(newQuote));
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
// --- Reviews ---
// Create a new review
// Create a new review
app.post('/reviews', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { rating, comment, bookId, userId } = req.body;
        if (!rating || !bookId || !userId) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const newReview = yield prisma.review.create({
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
        const aggregations = yield prisma.review.aggregate({
            _avg: {
                rating: true
            },
            where: {
                bookId: bookId
            }
        });
        const newAverageRating = aggregations._avg.rating || rating;
        // Update book with new rating
        yield prisma.book.update({
            where: { id: bookId },
            data: { rating: newAverageRating }
        });
        res.json(newReview);
    }
    catch (e) {
        console.error('Error creating review:', e);
        res.status(500).json({ error: 'Failed to create review' });
    }
}));
// Get reviews for a book
app.get('/reviews', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bookId } = req.query;
        if (!bookId) {
            res.status(400).json({ error: 'Missing bookId query parameter' });
            return;
        }
        const parsedBookId = parseInt(bookId);
        if (isNaN(parsedBookId)) {
            res.status(400).json({ error: 'Invalid bookId: must be a number' });
            return;
        }
        const reviews = yield prisma.review.findMany({
            where: { bookId: parsedBookId },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reviews);
    }
    catch (e) {
        console.error('Error fetching reviews:', e);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
}));
const hybridSearch_1 = require("./services/hybridSearch");
app.get('/google-books/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            res.status(400).json({ error: 'Missing query parameter "q"' });
            return;
        }
        console.log(`[Server] Searching for: ${q} (Hybrid Mode)`);
        const results = yield (0, hybridSearch_1.searchHybrid)(q);
        res.json(results);
    }
    catch (e) {
        console.error('Error in Google Books search endpoint:', e);
        res.status(500).json({ error: 'Failed to search Google Books' });
    }
}));
// Import a book from Google Books data
app.post('/books/import', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const bookData = req.body;
        if (!bookData.title && !bookData.googleId && !bookData.openLibraryId) {
            res.status(400).json({ error: 'Book data must have an ID or title' });
            return;
        }
        console.log(`[Server] Importing book: ${bookData.title}`);
        console.log(`[Server] Received bookData:`, JSON.stringify(bookData, null, 2));
        let existingBook = null;
        // 1. Check by OpenLibraryId (Best for de-duplication)
        if (bookData.openLibraryId) {
            existingBook = yield prisma.book.findUnique({
                where: { openLibraryId: bookData.openLibraryId },
                include: { author: true }
            });
        }
        // 2. Check by GoogleId (Legacy / Fallback)
        if (!existingBook && bookData.googleId) {
            existingBook = yield prisma.book.findUnique({
                where: { googleId: bookData.googleId },
                include: { author: true }
            });
        }
        // 3. Check by Title (Last resort for legacy)
        if (!existingBook && bookData.title) {
            existingBook = yield prisma.book.findUnique({
                where: { title: bookData.title },
                include: { author: true }
            });
        }
        if (existingBook) {
            console.log(`[Server] Book found: ${existingBook.title}. Updating metadata...`);
            // If we found it via Title/GoogleId but now we have an OL ID, we should update it!
            const shouldUpdateOlId = bookData.openLibraryId && !existingBook.openLibraryId;
            const openLibraryId = shouldUpdateOlId ? bookData.openLibraryId : existingBook.openLibraryId;
            // Generate buy links if missing
            let buyLinksJson = existingBook.buyLinks;
            if (!buyLinksJson || buyLinksJson === '[]') {
                // Helper to generate buy links
                const buyLinks = [];
                if (bookData.buyLink) {
                    buyLinks.push({ store: 'Google Play', url: bookData.buyLink, price: bookData.price || '' });
                }
                const isbn = bookData.isbn || existingBook.isbn;
                if (isbn) {
                    buyLinks.push({ store: 'Amazon', url: `https://www.amazon.fr/s?k=${isbn}`, price: '' });
                    buyLinks.push({ store: 'Fnac', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${isbn}`, price: '' });
                    buyLinks.push({ store: 'Chasse-aux-livres', url: `https://www.chasse-aux-livres.fr/pr/${isbn}`, price: '' });
                }
                else {
                    // Fallback: Search by Title + Author
                    const query = encodeURIComponent(`${existingBook.title} ${((_a = existingBook.author) === null || _a === void 0 ? void 0 : _a.name) || ''}`.trim());
                    buyLinks.push({ store: 'Amazon', url: `https://www.amazon.fr/s?k=${query}`, price: '' });
                    buyLinks.push({ store: 'Fnac', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${query}`, price: '' });
                }
                buyLinksJson = JSON.stringify(buyLinks);
            }
            const updatedBook = yield prisma.book.update({
                where: { id: existingBook.id },
                data: {
                    googleId: bookData.googleId || existingBook.googleId, // prefer new ID if available? or existing?
                    openLibraryId: openLibraryId,
                    isbn: bookData.isbn || existingBook.isbn,
                    description: existingBook.description || bookData.description, // prefer existing description if present? Actually OL/GB strategy says use GB description.
                    // If existing description is empty, use new.
                    cover: (existingBook.cover && existingBook.cover.length > 0) ? existingBook.cover : bookData.cover,
                    pages: existingBook.pages || bookData.pages,
                    year: existingBook.year || bookData.year,
                    genre: existingBook.genre || bookData.genre,
                    rating: (existingBook.rating === 0 || existingBook.rating === null) ? (bookData.rating || existingBook.rating) : existingBook.rating,
                    buyLinks: buyLinksJson
                }
            });
            const fullUpdatedBook = yield prisma.book.findUnique({
                where: { id: updatedBook.id },
                include: { author: true }
            });
            res.json(formatBook(fullUpdatedBook));
            return;
        }
        // 3. Create New Book
        const authorName = bookData.authors && bookData.authors.length > 0 ? bookData.authors[0] : 'Unknown';
        let author = yield prisma.author.findUnique({ where: { name: authorName } });
        if (!author) {
            author = yield prisma.author.create({
                data: { name: authorName }
            });
        }
        // Helper to generate buy links
        const buyLinks = [];
        if (bookData.buyLink) {
            buyLinks.push({ store: 'Google Play', url: bookData.buyLink, price: bookData.price || '' });
        }
        if (bookData.isbn) {
            buyLinks.push({ store: 'Amazon', url: `https://www.amazon.fr/s?k=${bookData.isbn}`, price: '' });
            buyLinks.push({ store: 'Fnac', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${bookData.isbn}`, price: '' });
            buyLinks.push({ store: 'Chasse-aux-livres', url: `https://www.chasse-aux-livres.fr/pr/${bookData.isbn}`, price: '' });
        }
        else {
            const query = encodeURIComponent(`${bookData.title} ${authorName}`.trim());
            buyLinks.push({ store: 'Amazon', url: `https://www.amazon.fr/s?k=${query}`, price: '' });
            buyLinks.push({ store: 'Fnac', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${query}`, price: '' });
        }
        const buyLinksJson = JSON.stringify(buyLinks);
        const newBook = yield prisma.book.create({
            data: {
                title: bookData.title,
                googleId: bookData.googleId,
                openLibraryId: bookData.openLibraryId,
                isbn: bookData.isbn,
                description: bookData.description || '',
                year: bookData.year || 0,
                pages: bookData.pages || 0,
                cover: bookData.cover || '',
                genre: bookData.genre || 'Unknown',
                authorId: author.id,
                rating: bookData.rating || 0,
                buyLinks: buyLinksJson
            },
            include: {
                author: true
            }
        });
        console.log(`[Server] Created new book: ${newBook.title}`);
        res.json(formatBook(newBook));
    }
    catch (e) {
        console.error('Error importing book:', e);
        res.status(500).json({ error: 'Failed to import book' });
    }
}));
// --- Search ---
app.get('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') { // Fixed logic here as well
            res.status(400).json({ error: 'Missing or invalid query parameter "q"' });
            return;
        }
        const query = q.toLowerCase();
        console.log(`[Server] Search query: "${query}"`);
        // 1. Search Quotes (text or theme)
        const quotes = yield prisma.quote.findMany({
            where: {
                OR: [
                    { text: { contains: query } },
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
        const authors = yield prisma.author.findMany({
            where: {
                name: { contains: query }
            },
            take: 10
        });
        // 3. Search Books
        const books = yield prisma.book.findMany({
            where: {
                title: { contains: query }
            },
            include: { author: true },
            take: 10
        });
        // 4. Search Themes (Derived from Quotes)
        const themesRaw = yield prisma.quote.findMany({
            where: {
                theme: { contains: query }
            },
            select: { theme: true },
            distinct: ['theme'],
            take: 10
        });
        const themes = themesRaw.map(t => t.theme).filter(t => t !== null);
        // Process quotes
        const formattedQuotes = quotes.map(formatQuote);
        // Process books
        const formattedBooks = books.map(formatBook);
        res.json({
            quotes: formattedQuotes,
            authors,
            books: formattedBooks,
            themes
        });
    }
    catch (e) {
        console.error('Error performing search:', e);
        res.status(500).json({ error: 'Failed to perform search' });
    }
}));
// --- Seeding ---
function seedIfNeeded() {
    return __awaiter(this, void 0, void 0, function* () {
        const count = yield prisma.user.count(); // Check users instead of authors, or just quote table
        if (count === 0) {
            yield (0, seedData_1.seed)();
        }
    });
}
app.listen(port, () => __awaiter(void 0, void 0, void 0, function* () {
    yield seedIfNeeded();
    console.log(`Server running at http://localhost:${port}`);
}));
