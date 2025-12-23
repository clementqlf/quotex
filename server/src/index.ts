import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const port = 3000;

app.use(cors());
app.use(express.json());

// Get all quotes
app.get('/quotes', async (req, res) => {
    try {
        console.log('GET /quotes accessed');
        const quotes = await prisma.quote.findMany({
            orderBy: { date: 'desc' }
        });
        console.log(`Returning ${quotes.length} quotes`);
        res.json(quotes);
    } catch (e) {
        console.error('Error fetching quotes:', e);
        res.status(500).json({ error: 'Failed to fetch quotes' });
    }
});

// Create a new quote
app.post('/quotes', async (req, res) => {
    try {
        const { text, author, book } = req.body;
        console.log('POST /quotes received:', { text, author, book });

        if (!text || !author || !book) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const newQuote = await prisma.quote.create({
            data: {
                text,
                author,
                book,
                date: new Date()
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
        console.log(`DELETE /quotes/${id} received`);

        await prisma.quote.delete({
            where: { id: parseInt(id) }
        });

        console.log('Deleted quote:', id);
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting quote:', e);
        res.status(500).json({ error: 'Failed to delete quote' });
    }
});

// Seed some data if empty
async function seedIfNeeded() {
    const count = await prisma.quote.count();
    if (count === 0) {
        console.log('Seeding initial data...');
        await prisma.quote.createMany({
            data: [
                {
                    text: "The only way to do great work is to love what you do.",
                    author: "Steve Jobs",
                    book: "Stanford Commencement Address"
                },
                {
                    text: "It does not matter how slowly you go as long as you do not stop.",
                    author: "Confucius",
                    book: "Analects"
                }
            ]
        });
        console.log('Seeded.');
    }
}

app.listen(port, async () => {
    await seedIfNeeded();
    console.log(`Server running at http://localhost:${port}`);
});
