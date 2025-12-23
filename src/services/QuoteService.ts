import { Quote } from '../../types';
import { Platform } from 'react-native';
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

    // Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator
    // Replace with your machine's local IP (e.g., 192.168.1.x) for physical device testing
    private readonly API_URL = Platform.select({
        android: 'http://10.0.2.2:3000/quotes',
        ios: 'http://192.168.1.123:3000/quotes', // Updated with your local IP
        default: 'http://192.168.1.123:3000/quotes',
    });



    async getQuotes(): Promise<Quote[]> {
        // Try fetching from server first
        try {
            console.log('Fetching quotes from:', this.API_URL);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

            const response = await fetch(this.API_URL!, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const serverQuotes = await response.json();
                console.log('Server response:', serverQuotes.length, 'quotes');

                // Map server data to Quote type and merge with local persistence if needed
                // For this prototype, we just return server data formatted as Quote objects
                const mappedQuotes: Quote[] = serverQuotes.map((q: any) => ({
                    id: q.id,
                    text: q.text,
                    book: q.book,
                    author: q.author,
                    // Default values for fields not in server
                    theme: 'General',
                    likes: 0,
                    isLiked: false,
                    // user field intentionally undefined so it shows in "My Quotes"
                    date: new Date().toISOString(),
                    isSaved: false,
                    comments: 0,
                    blockData: {},
                }));
                console.log('Mapped server quotes:', JSON.stringify(mappedQuotes, null, 2));
                return mappedQuotes;
            }
        } catch (error) {
            console.log('Server unreachable, falling back to local storage:', error);
        }

        // Fallback to local storage
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
        try {
            console.log('Deleting quote on server:', id);
            const response = await fetch(`${this.API_URL}/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                console.log('Quote deleted on server');
                return;
            }
        } catch (error) {
            console.error('Network error deleting quote:', error);
        }

        await delay(300);
        const quotes = await this.getQuotes();
        const newQuotes = quotes.filter(q => q.id !== id);
        await StorageService.setItem(STORAGE_KEYS.QUOTES, newQuotes);
    }

    async addQuote(text: string, book: string, author: string): Promise<void> {
        try {
            console.log('Sending quote to server:', { text, book, author });
            const response = await fetch(this.API_URL!, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text, book, author }),
            });

            if (response.ok) {
                console.log('Quote saved to server');
                // We rely on re-fetching or optimistic UI from DataProvider
                return;
            } else {
                console.error('Server error saving quote:', await response.text());
            }
        } catch (error) {
            console.error('Network error saving quote, falling back to local:', error);
        }

        // Fallback or Legacy: Save locally if server fails (or as backup)
        await delay(500);
        const quotes = await this.getQuotes();
        const newQuote: Quote = {
            id: Date.now(),
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
