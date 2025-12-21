import { Quote } from '../../types';
import { localQuotesDB, globalQuotesDB, addQuote as addQuoteToStatic } from '../../data/staticData';
import { StorageService, STORAGE_KEYS } from './StorageService';

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve as () => void, ms));

class QuoteService {
    private async seedDataIfNeeded(): Promise<void> {
        const storedQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES);
        if (!storedQuotes) {
            console.log('Seeding quotes from static data...');
            // Normalize static data to Quote type
            const initialQuotes = [...localQuotesDB, ...globalQuotesDB].map(q => ({
                id: q.id,
                text: q.text,
                book: q.book,
                author: q.author,
                theme: (q as any).theme || undefined,
                likes: q.likes,
                isLiked: q.isLiked,
                user: (q as any).user,
                date: (q as any).date || (q as any).time,
                isSaved: (q as any).isSaved,
                comments: (q as any).comments,
                blockData: (q as any).blockData || {},
            } as Quote));
            await StorageService.setItem(STORAGE_KEYS.QUOTES, initialQuotes);
        }
    }

    async getQuotes(): Promise<Quote[]> {
        await delay(500);
        await this.seedDataIfNeeded();
        const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES);
        return quotes || [];
    }

    async getQuoteById(id: number): Promise<Quote | undefined> {
        await delay(300);
        const quotes = await this.getQuotes();
        return quotes.find(q => q.id === id);
    }

    async toggleLike(id: number): Promise<Quote | undefined> {
        await delay(200);
        const quotes = await this.getQuotes();
        const quoteIndex = quotes.findIndex(q => q.id === id);

        if (quoteIndex > -1) {
            const quote = quotes[quoteIndex];
            quote.isLiked = !quote.isLiked;
            quote.likes += quote.isLiked ? 1 : -1;
            quotes[quoteIndex] = quote;
            await StorageService.setItem(STORAGE_KEYS.QUOTES, quotes);
            return quote;
        }
        return undefined;
    }

    async deleteQuote(id: number): Promise<void> {
        await delay(300);
        const quotes = await this.getQuotes();
        const newQuotes = quotes.filter(q => q.id !== id);
        await StorageService.setItem(STORAGE_KEYS.QUOTES, newQuotes);
    }

    async addQuote(text: string, book: string, author: string): Promise<void> {
        await delay(500);
        const quotes = await this.getQuotes();
        const newQuote: Quote = {
            id: Date.now(), // Generate a unique ID
            text,
            book,
            author,
            likes: 0,
            isLiked: false,
            date: new Date().toISOString(),
            isSaved: false,
            comments: 0,
            blockData: {},
        };
        const updatedQuotes = [newQuote, ...quotes];
        await StorageService.setItem(STORAGE_KEYS.QUOTES, updatedQuotes);
    }

    async updateQuote(id: number, updates: Partial<Quote>): Promise<void> {
        await delay(300);
        const quotes = await this.getQuotes();
        const quoteIndex = quotes.findIndex(q => q.id === id);
        if (quoteIndex > -1) {
            quotes[quoteIndex] = { ...quotes[quoteIndex], ...updates };
            await StorageService.setItem(STORAGE_KEYS.QUOTES, quotes);
        }
    }
}

export const quoteService = new QuoteService();
