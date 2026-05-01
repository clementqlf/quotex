import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma';
import { seed } from './seedData';
import { searchHybrid } from './services/hybridSearch';
import { getExternalAuthorBooks, searchExternalAuthors } from './services/externalAuthor';
import {
    searchInventaireWorks,
    searchInventaireAuthors,
    enrichAuthorWithInventaire as enrichAuthor,
    getWorkEditions,
    getInventaireWorkDetails,
    getInventaireAuthorDetails,
    getBatchInventaireDetails,
    InventaireSearchResult,
    InventaireEdition,
    fetchWikipediaSynopsis,
    enrichWorkMetadata
} from './services/inventaire';
import { getNotableWorksDetailed } from './services/notableWorks';
import { enrichBookWithInventaire, discoverAndEnrichBook } from './services/bookEnrichment';
import { backgroundQueue } from './services/queue';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest, optionalAuthenticateToken } from './middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_super_secure_123';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper to format book (parse JSON fields and flatten user state)
const formatBook = (book: any, userId: number = 1) => {
    if (!book) return null;
    let buyLinks = [];
    try {
        if (book.buyLinks && typeof book.buyLinks === 'string' && book.buyLinks.trim().length > 0) {
            buyLinks = JSON.parse(book.buyLinks);
        } else if (Array.isArray(book.buyLinks)) {
            buyLinks = book.buyLinks;
        }
    } catch (e) {
        console.error(`Error parsing buyLinks for book ${book.id}:`, e);
    }

    const userLink = book.users?.find((u: any) => u.userId === userId);

    return {
        ...book,
        isSaved: !!userLink,
        readingStatus: userLink?.status || null,
        buyLinks,
    };
};

// Helper to format author
const formatAuthor = (author: any, userId: number = 1) => {
    if (!author) return null;
    const userLink = author.users?.find((u: any) => u.userId === userId);
    return {
        ...author,
        isSaved: !!userLink,
        quotesCount: author._count ? author._count.quotes : (author.quotesCount || 0)
    };
};

// Helper to format quote (including nested book)
const formatQuote = (quote: any, userId: number = 1) => {
    if (!quote) return null;
    const isSaved = quote.savedBy ? quote.savedBy.some((s: any) => s.userId === userId) : false;
    return {
        ...quote,
        book: quote.book ? formatBook(quote.book, userId) : null,
        isSaved,
        isLiked: quote.likes ? quote.likes.some((l: any) => l.userId === userId) : false,
        likesCount: quote._count ? quote._count.likes : (quote.likesCount || 0)
    };
};

// --- Auth Endpoints ---

app.post('/auth/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const user = await prisma.user.findUnique({
            where: { email }
        });
        res.json({ exists: !!user });
    } catch (e) {
        console.error('Check email error:', e);
        res.status(500).json({ error: 'Failed to check email' });
    }
});

app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, username, name } = req.body;

        if (!email || !password || !username) {
            return res.status(400).json({ error: 'Email, password and username are required' });
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }]
            }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email or username' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                username,
                name: name || username
            }
        });

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json({ user: userWithoutPassword, token });
    } catch (e) {
        console.error('Registration error:', e);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, token });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// --- Endpoints ---

// Get all quotes
app.get('/quotes', optionalAuthenticateToken, async (req: AuthRequest, res) => {
    try {
        console.log('GET /quotes accessed');
        const userId = req.user?.id || 1; // Fallback to 1 for demo/public view if needed, or 0/null

        const quotes = await prisma.quote.findMany({
            include: {
                author: true,
                book: {
                    include: { users: { where: { userId } } }
                },
                user: true,
                likes: {
                    where: { userId: userId }
                },
                savedBy: {
                    where: { userId: userId }
                },
                _count: {
                    select: { likes: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        const quotesWithLikeStatus = quotes.map(q => formatQuote(q, userId));

        console.log(`Returning ${quotesWithLikeStatus.length} quotes`);
        res.json(quotesWithLikeStatus);
    } catch (e) {
        console.error('Error fetching quotes:', e);
        res.status(500).json({ error: 'Failed to fetch quotes' });
    }
});

// Get single quote by ID
app.get('/quotes/:id', optionalAuthenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 1; 

        const quote = await prisma.quote.findUnique({
            where: { id: parseInt(id) },
            include: {
                author: true,
                book: {
                    include: { users: { where: { userId } } }
                },
                user: true,
                likes: {
                    where: { userId: userId }
                },
                savedBy: {
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

        const quoteWithLikeStatus = formatQuote(quote, userId);

        res.json(quoteWithLikeStatus);
    } catch (e) {
        console.error('Error fetching quote:', e);
        res.status(500).json({ error: 'Failed to fetch quote' });
    }
});

// Toggle save status for a quote
app.post('/quotes/:id/toggle-save', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;
        const quoteId = parseInt(id);

        const existingLink = await prisma.userQuote.findUnique({
            where: {
                userId_quoteId: { userId, quoteId }
            }
        });

        if (existingLink) {
            await prisma.userQuote.delete({
                where: { userId_quoteId: { userId, quoteId } }
            });
            res.json({ isSaved: false });
        } else {
            await prisma.userQuote.create({
                data: { userId, quoteId }
            });
            res.json({ isSaved: true });
        }
    } catch (e) {
        console.error('Error toggling quote save status:', e);
        res.status(500).json({ error: 'Failed to toggle quote save status' });
    }
});

// Get all authors
app.get('/authors', optionalAuthenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user?.id || 1;
        const authors = await prisma.author.findMany({
            include: {
                books: {
                    include: { users: { where: { userId } } }
                },
                users: { where: { userId } },
                similarAuthors: true,
                _count: {
                    select: { quotes: true }
                }
            }
        });
        const formattedAuthors = authors.map((a: any) => formatAuthor(a, userId));
        res.json(formattedAuthors);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch authors' });
    }
});

// Get or Create author by name
app.get('/authors/by-name/:name', async (req, res) => {
    try {
        const { name } = req.params;
        let authorRecord = await prisma.author.findUnique({
            where: { name },
            include: {
                books: true,
                _count: {
                    select: { quotes: true }
                }
            }
        });

        if (!authorRecord) {
            console.log(`[Server] Author not found in DB: ${name}. Creating and enriching...`);
            const newAuthor = await prisma.author.create({
                data: { name }
            });
            // Enrich synchronously so the first load has data (or at least bio/image)
            await enrichAuthor(newAuthor.id);
            // Re-fetch with data
            authorRecord = await prisma.author.findUnique({
                where: { id: newAuthor.id },
                include: {
                    books: true,
                    _count: {
                        select: { quotes: true }
                    }
                }
            });
        }

        if (!authorRecord) {
            res.status(404).json({ error: 'Author not found and could not be created' });
            return;
        }

        const formattedAuthor = {
            ...authorRecord,
            quotesCount: (authorRecord as any)._count.quotes
        };
        res.json(formattedAuthor);
    } catch (e) {
        console.error('Error in get-author-by-name:', e);
        res.status(500).json({ error: 'Failed to fetch author' });
    }
});
app.get('/authors/:id/books', async (req, res) => {
    try {
        const { id } = req.params;
        const authorId = parseInt(id);

        let books = await prisma.book.findMany({
            where: { authorId },
            orderBy: { year: 'desc' }
        });

        const author = await prisma.author.findUnique({ where: { id: authorId } });

        // If very few books, trigger enrichment in background if it hasn't been done recently/fully
        // If very few books, trigger enrichment and WAIT for it to complete
        if (books.length <= 1 && author) {
            console.log(`[Server] Triggering enrichment (awaited) for author: ${author.name}`);
            try {
                await enrichAuthor(author.id);
                // Refresh books after enrichment
                books = await prisma.book.findMany({
                    where: { authorId },
                    orderBy: { year: 'desc' }
                });
            } catch (e: any) {
                console.error("Enrichment failed", e);
            }
        }

        res.json(books.map(formatBook));
    } catch (e) {
        console.error("Error fetching author books:", e);
        res.status(500).json({ error: 'Failed to fetch author books' });
    }
});

// Endpoint to fetch and sync notable works for an author
app.get('/authors/:id/notable-works', async (req, res) => {
    try {
        const { id } = req.params;
        const authorId = parseInt(id);

        const author = await prisma.author.findUnique({ where: { id: authorId } });
        if (!author) return res.status(404).json({ error: 'Author not found' });

        console.log(`[Server] Syncing notable works for author: ${author.name}`);

        // This now returns only { title, uri } from Wikidata
        const notableWorks = await getNotableWorksDetailed(author.name);
        if (notableWorks.length === 0) {
            console.log(`[Server] No notable works found for ${author.name}`);
            return res.json([]);
        }

        const results = [];

        for (const work of notableWorks) {
            // Check if book exists by inventaireUri or title
            let book: any = await prisma.book.findFirst({
                where: {
                    OR: [
                        { inventaireUri: work.uri },
                        { AND: [{ title: work.title }, { authorId: author.id }] }
                    ]
                },
                include: { author: true }
            });

            if (!book) {
                console.log(`[Server] Notable work "${work.title}" not in DB yet. Creating basic record...`);
                book = await prisma.book.create({
                    data: {
                        title: work.title,
                        authorId: author.id,
                        inventaireUri: work.uri,
                        genre: '',
                        description: ''
                    },
                    include: { author: true }
                });
            }

            console.log(`[Server] Notable work matched: "${work.title}"`);
            results.push(formatBook(book));

            // Background enrichment ONLY if we lack basic data (description or cover)
            if (book && (book.inventaireUri) && (!book.description || book.description.length < 50 || !book.cover)) {
                backgroundQueue.add(() => enrichBookWithInventaire(book.id)).catch(err =>
                    console.error(`[Server] Background enrichment failed for ${book.title}:`, err)
                );
            }
        }

        res.json(results);
    } catch (e) {
        console.error("Error syncing notable works:", e);
        res.status(500).json({ error: 'Failed to sync notable works' });
    }
});

// Explicitly enrichment author
app.post('/authors/:id/enrich', async (req, res) => {
    try {
        const { id } = req.params;
        const author = await prisma.author.findUnique({ where: { id: parseInt(id) } });
        if (!author) return res.status(404).json({ error: 'Author not found' });

        await enrichAuthor(author.id);

        // Return updated books
        const books = await prisma.book.findMany({
            where: { authorId: author.id },
            orderBy: { year: 'desc' }
        });
        res.json({ success: true, books: books.map(formatBook) });
    } catch (e) {
        res.status(500).json({ error: 'Failed to enrich author' });
    }
});

// Toggle save status for an author
app.post('/authors/:id/toggle-save', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const authorId = parseInt(id);
        const userId = req.user!.id;

        const existingLink = await prisma.userAuthor.findUnique({
            where: {
                userId_authorId: { userId, authorId }
            }
        });

        if (existingLink) {
            await prisma.userAuthor.delete({
                where: { userId_authorId: { userId, authorId } }
            });
            res.json({ isSaved: false });
        } else {
            await prisma.userAuthor.create({
                data: { userId, authorId }
            });
            res.json({ isSaved: true });
        }
    } catch (e) {
        console.error('Error toggling author save status:', e);
        res.status(500).json({ error: 'Failed to toggle author save status' });
    }
});

// Get single book by ID
app.get('/books/:id', optionalAuthenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 1;
        const book = await prisma.book.findUnique({
            where: { id: parseInt(id) },
            include: {
                author: true,
                similarBooks: true,
                editions: true,
                users: { where: { userId } }
            } as any
        });

        if (!book) {
            res.status(404).json({ error: 'Book not found' });
            return;
        }


        // We do not trigger async Inventaire enrichment here anymore 
        // to avoid duplicate heavy workloads just because a description is missing.
        // Import/creation correctly handles the first full enrichment.

        res.json(formatBook(book));
    } catch (e) {
        console.error('Error fetching book:', e);
        res.status(500).json({ error: 'Failed to fetch book' });
    }
});

// Toggle save status for a book
app.post('/books/:id/toggle-save', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const bookId = parseInt(id);
        const userId = req.user!.id;

        const existingLink = await prisma.userBook.findUnique({
            where: {
                userId_bookId: { userId, bookId }
            }
        });

        if (existingLink) {
            await prisma.userBook.delete({
                where: { userId_bookId: { userId, bookId } }
            });
            res.json({ isSaved: false });
        } else {
            await prisma.userBook.create({
                data: { userId, bookId }
            });
            res.json({ isSaved: true });
        }
    } catch (e) {
        console.error('Error toggling book save status:', e);
        res.status(500).json({ error: 'Failed to toggle book save status' });
    }
});

// Update reading status for a book
app.patch('/books/:id/status', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { readingStatus } = req.body;
        const bookId = parseInt(id);
        const userId = req.user!.id;

        if (!readingStatus) {
            res.status(400).json({ error: 'Missing readingStatus' });
            return;
        }

        // When a status is set, the book is automatically saved
        const updatedLink = await prisma.userBook.upsert({
            where: {
                userId_bookId: { userId, bookId }
            },
            update: { status: readingStatus },
            create: { userId, bookId, status: readingStatus }
        });

        const book = await prisma.book.findUnique({
            where: { id: bookId },
            include: { users: { where: { userId } }, author: true }
        });

        res.json(formatBook(book, userId));
    } catch (e) {
        console.error('Error updating book status:', e);
        res.status(500).json({ error: 'Failed to update book status' });
    }
});

// Get all books
app.get('/books', optionalAuthenticateToken, async (req: AuthRequest, res) => {
    try {
        const { authorName } = req.query;
        console.log(`[Server] GET /books accessed. Filter: ${authorName || 'None'}`);
        const userId = req.user?.id || 1;

        const where: any = {};
        if (authorName && typeof authorName === 'string') {
            where.author = {
                name: {
                    equals: authorName
                }
            };
        }

        const books = await prisma.book.findMany({
            where,
            include: {
                author: true,
                similarBooks: true,
                users: { where: { userId } }
            }
        });

        const formattedBooks = books.map(b => formatBook(b, userId));
        res.json(formattedBooks);
    } catch (e) {
        console.error('Error fetching books:', e);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

// Get user by username
app.get('/users/:username', optionalAuthenticateToken, async (req: AuthRequest, res) => {
    try {
        const { username } = req.params;
        const userId = req.user?.id || 1;
        // Handle @ prefix
        const cleanUsername = username.startsWith('@') ? username : `@${username}`;

        const user = await prisma.user.findUnique({
            where: { username: cleanUsername },
            include: {
                quotes: {
                    include: {
                        book: {
                            include: { users: { where: { userId } } }
                        },
                        author: true,
                        savedBy: { where: { userId } },
                        likes: { where: { userId } }
                    }
                }
            }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const formattedUser = {
            ...user,
            quotes: user.quotes.map((q: any) => formatQuote({ ...q, user })) // optimizing to not re-fetch user
        };
        res.json(formattedUser);
    } catch (e) {
        console.error("Error fetching user", e);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update current user profile
app.patch('/users/me', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;
        const { username, password, name } = req.body;

        const data: any = {};
        if (username) {
            // Check if username is already taken
            const cleanUsername = username.startsWith('@') ? username : `@${username}`;
            const existing = await prisma.user.findFirst({
                where: { 
                    username: cleanUsername,
                    id: { not: userId }
                }
            });
            if (existing) {
                return res.status(400).json({ error: 'Username already taken' });
            }
            data.username = cleanUsername;
        }

        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        if (name) {
            data.name = name;
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'Nothing to update' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data
        });

        const { password: _, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
    } catch (e) {
        console.error("Error updating user profile", e);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Create a new quote
app.post('/quotes', authenticateToken, async (req: AuthRequest, res) => {
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
            authorRecord = await prisma.author.create({ data: { name: author, isEnriching: true } as any });
            // Enrich author asynchronously
            backgroundQueue.add(() => enrichAuthor(authorRecord!.id)).catch((err: any) =>
                console.error(`[Server] Async enrichment failed for ${author}:`, err)
            );
        }

        // 2. Find or Create Book
        let bookRecord = await prisma.book.findFirst({
            where: {
                title: book,
                authorId: authorRecord.id
            }
        });

        if (!bookRecord) {
            bookRecord = await prisma.book.create({
                data: {
                    title: book,
                    authorId: authorRecord.id,
                    isEnriching: true
                } as any
            });
        }


        // 2.5 Trigger Book Enrichment/Discovery
        // We trigger it if the book is newly created OR if it lacks basic data
        if (!bookRecord || !(bookRecord as any).description || !(bookRecord as any).inventaireUri) {
            console.log(`[Server] Quote added for book: "${book}". Triggering background discovery/enrichment.`);
            backgroundQueue.add(() => discoverAndEnrichBook(bookRecord!.id)).catch(err =>
                console.error(`[Server] Background discovery failed for ${book}:`, err)
            );
        }

        // 3. Create Quote
        const newQuote = await prisma.quote.create({
            data: {
                text,
                date: new Date(),
                authorId: authorRecord.id,
                bookId: bookRecord.id,

                userId: req.user!.id, 
                theme,
                likesCount: 0
            },
            include: {
                author: true,
                book: {
                    include: { users: { where: { userId: req.user!.id } } }
                },
                user: true,
                savedBy: { where: { userId: req.user!.id } },
                likes: { where: { userId: req.user!.id } }
            }
        });

        console.log('Created quote:', newQuote.id);
        res.json(formatQuote(newQuote, req.user!.id));
    } catch (e) {
        console.error('Error creating quote:', e);
        res.status(500).json({ error: 'Failed to create quote' });
    }
});

// Update a quote
app.patch('/quotes/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const { text, author, book, theme } = req.body;
        const quoteId = parseInt(id);
        const userId = req.user!.id;

        console.log(`PATCH /quotes/${id} received:`, { text, author, book, theme });

        const existingQuote = await prisma.quote.findUnique({
            where: { id: quoteId },
            include: { author: true, book: true }
        });

        if (!existingQuote) {
            res.status(404).json({ error: 'Quote not found' });
            return;
        }

        let authorId = existingQuote.authorId;
        let bookId = existingQuote.bookId;

        // 1. Handle Author update if name provided
        if (author && typeof author === 'string' && author !== existingQuote.author.name) {
            let authorRecord = await prisma.author.findUnique({ where: { name: author } });
            if (!authorRecord) {
                authorRecord = await prisma.author.create({ data: { name: author, isEnriching: true } as any });
                backgroundQueue.add(() => enrichAuthor(authorRecord!.id)).catch((err: any) =>
                    console.error(`[Server] Async enrichment failed for ${author}:`, err)
                );
            }
            authorId = authorRecord.id;
        }

        // 2. Handle Book update if name provided
        if (book && typeof book === 'string' && (!existingQuote.book || book !== existingQuote.book.title)) {
            // Find or create book for THIS author
            let bookRecord = await prisma.book.findFirst({
                where: {
                    title: book,
                    authorId: authorId
                }
            });
            if (!bookRecord) {
                bookRecord = await prisma.book.create({
                    data: {
                        title: book,
                        authorId: authorId,
                        isEnriching: true
                    } as any
                });
            }
            bookId = bookRecord.id;

            // Trigger discovery/enrichment for the updated book
            if (bookId && (!bookRecord || !(bookRecord as any).description || !(bookRecord as any).inventaireUri)) {
                console.log(`[Server] Quote updated with new/incomplete book: "${book}". Triggering background discovery/enrichment.`);
                backgroundQueue.add(() => discoverAndEnrichBook(bookId!)).catch(err =>
                    console.error(`[Server] Background discovery failed for ${book}:`, err)
                );
            }
        }

        // 3. Update Quote
        const updatedQuote = await prisma.quote.update({
            where: { id: quoteId },
            data: {
                text: text !== undefined ? text : existingQuote.text,
                theme: theme !== undefined ? theme : existingQuote.theme,
                authorId,
                bookId
            },
            include: {
                author: true,
                book: {
                    include: { users: { where: { userId: 1 } } }
                },
                user: true,
                likes: {
                    where: { userId: 1 } // Hardcoded for now
                },
                savedBy: {
                    where: { userId: 1 }
                },
                _count: {
                    select: { likes: true }
                }
            }
        });

        res.json(formatQuote(updatedQuote, 1));
    } catch (e) {
        console.error('Error updating quote:', e);
        res.status(500).json({ error: 'Failed to update quote' });
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
app.post('/reviews', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { rating, comment, bookId } = req.body;
        const userId = req.user!.id;

        if (!rating || !bookId) {
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


app.get('/google-books/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            res.status(400).json({ error: 'Missing query parameter "q"' });
            return;
        }

        console.log(`[Server] Searching for: ${q} (Hybrid Mode)`);
        const results = await searchHybrid(q);
        res.json(results);
    } catch (e) {
        console.error('Error in Google Books search endpoint:', e);
        res.status(500).json({ error: 'Failed to search Google Books' });
    }
});

// Import a book from Google Books data
app.post('/books/import', async (req, res) => {
    try {
        const bookData = req.body;

        if (!bookData.title && !bookData.googleId && !bookData.openLibraryId) {
            res.status(400).json({ error: 'Book data must have an ID or title' });
            return;
        }

        console.log(`[Server] Importing book: ${bookData.title}`);
        console.log(`[Server] Received bookData:`, JSON.stringify(bookData, null, 2));

        let extractedAuthorDescription: string | null = null;

        let existingBook: any = null;

        // 1. Check by InventaireUri (Most canonical for Works)
        if (bookData.inventaireUri) {
            existingBook = await (prisma.book as any).findFirst({
                where: { inventaireUri: bookData.inventaireUri },
                include: { author: true }
            });
        }

        // 2. Check by OpenLibraryId
        if (!existingBook && bookData.openLibraryId) {
            existingBook = await prisma.book.findUnique({
                where: { openLibraryId: bookData.openLibraryId },
                include: { author: true }
            });
        }

        // 3. Check by GoogleId (Legacy / Fallback)
        if (!existingBook && bookData.googleId) {
            existingBook = await prisma.book.findUnique({
                where: { googleId: bookData.googleId },
                include: { author: true }
            });
        }

        // 4. Check by Title (Last resort for legacy)
        if (!existingBook && bookData.title) {
            existingBook = await prisma.book.findFirst({
                where: { title: bookData.title },
                include: { author: true }
            });
        }

        if (existingBook) {
            const book = existingBook as any;
            console.log(`[Server] Book found: ${book.title}. Updating metadata...`);

            // If we found it via Title/GoogleId but now we have an OL ID, we should update it!
            const shouldUpdateOlId = bookData.openLibraryId && !book.openLibraryId;
            const openLibraryId = shouldUpdateOlId ? bookData.openLibraryId : book.openLibraryId;

            // Generate buy links if missing
            let buyLinksJson = book.buyLinks;
            if (!buyLinksJson || buyLinksJson === '[]') {
                // Helper to generate buy links
                const buyLinks = [];
                if (bookData.buyLink) {
                    buyLinks.push({ store: 'Google Play', url: bookData.buyLink, price: bookData.price || '' });
                }

                const isbn = bookData.isbn || book.isbn;
                if (isbn) {
                    buyLinks.push({ store: 'Amazon', url: `https://www.amazon.fr/s?k=${isbn}`, price: '' });
                    buyLinks.push({ store: 'Fnac', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${isbn}`, price: '' });
                    buyLinks.push({ store: 'Chasse-aux-livres', url: `https://www.chasse-aux-livres.fr/pr/${isbn}`, price: '' });
                } else {
                    // Fallback: Search by Title + Author
                    const query = encodeURIComponent(`${book.title} ${book.author?.name || ''}`.trim());
                    buyLinks.push({ store: 'Amazon', url: `https://www.amazon.fr/s?k=${query}`, price: '' });
                    buyLinks.push({ store: 'Fnac', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${query}`, price: '' });
                }
                buyLinksJson = JSON.stringify(buyLinks);
            }

            const updatedBook = await prisma.book.update({
                where: { id: book.id },
                data: {
                    googleId: bookData.googleId || book.googleId,
                    openLibraryId: openLibraryId,
                    inventaireUri: bookData.inventaireUri || book.inventaireUri,
                    isbn: bookData.isbn || book.isbn,
                    description: book.description || bookData.description,
                    cover: (!book.cover || (book.cover.includes('wikimedia.org') && bookData.cover?.includes('/img/entities/'))) ? bookData.cover : book.cover,
                    pages: book.pages || bookData.pages,
                    year: book.year || bookData.year,
                    genre: book.genre || bookData.genre,
                    rating: (book.rating === 0 || book.rating === null) ? (bookData.rating || book.rating) : book.rating,
                    buyLinks: buyLinksJson
                }
            });
            const fullUpdatedBook = await prisma.book.findUnique({
                where: { id: updatedBook.id },
                include: { author: true }
            });

            // Ensure author is fully enriched (awaited to ensure bio is returned)
            if (fullUpdatedBook?.author) {
                const authorUri = (bookData.authorUris && bookData.authorUris.length > 0) ? bookData.authorUris[0] : undefined;
                backgroundQueue.add(() => enrichAuthor(fullUpdatedBook.author.id, undefined, authorUri)).catch((e: any) => console.error(e));
            }

            res.json(formatBook(fullUpdatedBook));
            return;
        }

        // 3. Create New Book
        let authorName = bookData.authors && bookData.authors.length > 0 ? bookData.authors[0] : 'Unknown';

        let author = await prisma.author.findUnique({ where: { name: authorName } });
        if (!author) {
            author = await prisma.author.create({
                data: {
                    name: authorName,
                    description: extractedAuthorDescription || null
                }
            });
        } else if (!author.description && extractedAuthorDescription) {
            author = await prisma.author.update({
                where: { id: author.id },
                data: { description: extractedAuthorDescription }
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
        } else {
            const query = encodeURIComponent(`${bookData.title} ${authorName}`.trim());
            buyLinks.push({ store: 'Amazon', url: `https://www.amazon.fr/s?k=${query}`, price: '' });
            buyLinks.push({ store: 'Fnac', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${query}`, price: '' });
        }
        const buyLinksJson = JSON.stringify(buyLinks);

        const newBook = await prisma.book.create({
            data: {
                title: bookData.title,
                googleId: bookData.googleId,
                openLibraryId: bookData.openLibraryId,
                inventaireUri: bookData.inventaireUri,
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

        // 1. Trigger enrichment for Inventaire books during import to get editions and synopsis
        if ((newBook as any).inventaireUri) {
            console.log(`[Server] Triggering full Inventaire enrichment for imported book: ${newBook.title}`);
            await enrichBookWithInventaire(newBook.id);
        } else {
            console.log(`[Server] No URI for imported book: ${newBook.title}. Triggering background discovery.`);
            backgroundQueue.add(() => discoverAndEnrichBook(newBook.id)).catch(e =>
                console.error(`[Server] Background discovery for imported book failed:`, e)
            );
        }

        // 2. Ensure author is enriched (awaited to ensure metadata is ready for first view)
        if (author.id) {
            const authorUri = (bookData.authorUris && bookData.authorUris.length > 0) ? bookData.authorUris[0] : undefined;
            backgroundQueue.add(() => enrichAuthor(author.id, undefined, authorUri)).catch((e: any) => console.error(e));
        }

        // 3. Final fetch to get fully enriched state (author + editions)
        const fullyEnriched = await prisma.book.findUnique({
            where: { id: newBook.id },
            include: {
                author: true,
                editions: true
            } as any
        });

        res.json(formatBook(fullyEnriched || newBook));

    } catch (e) {
        console.error('Error importing book:', e);
        res.status(500).json({ error: 'Failed to import book' });
    }
});

// Endpoint to get external author books
app.get('/external-authors/:id/books', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.query; // Pass name as query param if ID is OLID or just useful context

        if (!name || typeof name !== 'string') {
            res.status(400).json({ error: 'Author name is required as query param "name"' });
            return;
        }

        console.log(`[Server] Fetching external books for: ${name} (ID: ${id})`);

        // Use the new service
        const books = await getExternalAuthorBooks(name, id);
        res.json(books);

    } catch (e) {
        console.error('Error fetching external author books:', e);
        res.status(500).json({ error: 'Failed to fetch external author books' });
    }
});


// --- Search ---

// ─── Cache helpers ────────────────────────────────────────────────────────────
const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getCachedSearch(query: string, type: string): Promise<any[] | null> {
    const cache = await prisma.searchCache.findUnique({
        where: { query_type: { query: query.toLowerCase(), type } }
    });
    if (!cache) return null;
    if (new Date() > cache.expiresAt) {
        // Expired — delete and return null
        await prisma.searchCache.delete({ where: { id: cache.id } }).catch(() => { });
        return null;
    }
    try {
        return JSON.parse(cache.results);
    } catch {
        return null;
    }
}

async function setCachedSearch(query: string, type: string, results: any[]): Promise<void> {
    const expiresAt = new Date(Date.now() + SEARCH_CACHE_TTL_MS);
    const key = { query: query.toLowerCase(), type };
    try {
        await prisma.searchCache.upsert({
            where: { query_type: key },
            create: { ...key, results: JSON.stringify(results), expiresAt },
            update: { results: JSON.stringify(results), expiresAt },
        });
    } catch (e) {
        console.error('[Cache] Failed to store search cache:', e);
    }
}

// ─── /search (unified local + Inventaire) ────────────────────────────────────
app.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            res.status(400).json({ error: 'Missing or invalid query parameter "q"' });
            return;
        }

        const query = q.toLowerCase();
        console.log(`[Server] Search query: "${query}"`);

        // 1. Search Quotes (text or theme) — always local
        const quotes = await prisma.quote.findMany({
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

        // 2. Search Local Authors (Saved only)
        const localAuthorsRaw = await prisma.author.findMany({
            where: {
                name: { contains: query },
                users: { some: { userId: 1 } }
            },
            include: { users: { where: { userId: 1 } } },
            take: 10
        });
        const localAuthors = localAuthorsRaw.map(a => formatAuthor(a, 1));

        // 3. Search Local Books (Saved only)
        const localBooksRaw = await prisma.book.findMany({
            where: {
                title: { contains: query },
                users: { some: { userId: 1 } }
            },
            include: { 
                author: true,
                users: { where: { userId: 1 } }
            },
            take: 10
        });
        const books = localBooksRaw.map(b => formatBook(b, 1));

        // 4. Search Themes (local)
        const themesRaw = await prisma.quote.findMany({
            where: { theme: { contains: query } },
            select: { theme: true },
            distinct: ['theme'],
            take: 10
        });
        const themes = themesRaw.map((t: any) => t.theme).filter((t: any) => t !== null);

        // 5. External Inventaire Sujets (with cache)
        let inventaireWorks: InventaireSearchResult[] = [];
        const cachedSujets = await getCachedSearch(query, 'sujets');

        // Detect stale cache (missing authorUris or other new fields)
        const isSujetsCacheStale = cachedSujets && cachedSujets.length > 0 && typeof cachedSujets[0].authorUris === 'undefined';

        if (cachedSujets && !isSujetsCacheStale) {
            inventaireWorks = cachedSujets;
            console.log(`[Search] Cache hit — sujets for "${query}"`);
        } else {
            console.log(`[Search] ${isSujetsCacheStale ? 'Cache stale' : 'Cache miss'} — searching Inventaire sujets for "${query}"`);
            inventaireWorks = await searchInventaireWorks(query, 10);
            await setCachedSearch(query, 'sujets', inventaireWorks);
        }

        // Debug log sample
        if (inventaireWorks.length > 0) {
            console.log(`[Search] Sample result for "${query}": ${inventaireWorks[0].label} (authorUris: ${JSON.stringify(inventaireWorks[0].authorUris)})`);
        }

        // 6. External Inventaire Authors (with cache)
        let inventaireAuthors: InventaireSearchResult[] = [];
        const cachedAuthors = await getCachedSearch(query, 'humans');
        if (cachedAuthors) {
            inventaireAuthors = cachedAuthors;
            console.log(`[Search] Cache hit — humans for "${query}"`);
        } else {
            inventaireAuthors = await searchInventaireAuthors(query, 10);
            await setCachedSearch(query, 'humans', inventaireAuthors);
        }

        const formattedQuotes = quotes.map(q => formatQuote(q, 1));
        const formattedBooks = books; // Already formatted above

        res.json({
            quotes: formattedQuotes,
            authors: localAuthors,
            books: formattedBooks,
            themes,
            inventaireWorks,
            inventaireAuthors,
        });

    } catch (e) {
        console.error('Error performing search:', e);
        res.status(500).json({ error: 'Failed to perform search' });
    }
});

// ─── GET /books/:id/editions ──────────────────────────────────────────────────
const EDITIONS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

app.get('/books/:id/editions', async (req, res) => {
    try {
        const { id } = req.params;
        const bookId = parseInt(id);
        if (isNaN(bookId)) {
            res.status(400).json({ error: 'Invalid book ID' });
            return;
        }

        const book = await (prisma.book as any).findUnique({
            where: { id: bookId },
            include: { editions: { orderBy: { publishDate: 'asc' } } }
        });

        if (!book) {
            res.status(404).json({ error: 'Book not found' });
            return;
        }

        // If we have recent cached editions, return them
        if (book.editions && book.editions.length > 0) {
            const oldest = book.editions.reduce((min: any, e: any) =>
                e.createdAt < min.createdAt ? e : min, book.editions[0]);
            const ageMs = Date.now() - new Date(oldest.createdAt).getTime();
            if (ageMs < EDITIONS_CACHE_TTL_MS) {
                console.log(`[Editions] Cache hit for book ${bookId}`);
                return res.json(book.editions);
            }
        }

        // Need to fetch from Inventaire — we need inventaireUri
        if (!book.inventaireUri) {
            // Return whatever we have (may be empty)
            return res.json(book.editions || []);
        }

        console.log(`[Editions] Fetching from Inventaire for book ${bookId} (${book.inventaireUri})`);
        const editions = await getWorkEditions(book.inventaireUri);

        if (editions.length > 0) {
            // Delete old cached editions
            await prisma.edition.deleteMany({ where: { bookId } });

            // Store new editions
            await prisma.edition.createMany({
                data: editions.map((e: InventaireEdition) => ({
                    inventaireUri: e.inventaireUri,
                    isbn: e.isbn,
                    title: e.title,
                    publishDate: e.publishDate,
                    publisherUri: e.publisherUri,
                    languageUri: e.languageUri,
                    cover: e.cover,
                    bookId,
                })),
            });
        }

        const freshEditions = await prisma.edition.findMany({
            where: { bookId },
            orderBy: { publishDate: 'asc' }
        });
        res.json(freshEditions);

    } catch (e) {
        console.error('Error fetching book editions:', e);
        res.status(500).json({ error: 'Failed to fetch book editions' });
    }
});

// ─── Batch fetch Inventaire details ───
app.get('/inventaire/entities', async (req, res) => {
    try {
        const { uris } = req.query;
        if (!uris || typeof uris !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid uris parameter' });
        }
        const uriList = uris.split('|');
        console.log(`[Server] Batch fetching Inventaire details for ${uriList.length} URIs`);
        const details = await getBatchInventaireDetails(uriList);
        res.json(details);
    } catch (e) {
        console.error('Error batch fetching Inventaire details:', e);
        res.status(500).json({ error: 'Failed to fetch batch details' });
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
