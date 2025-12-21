import { Quote } from '../../types';
import { localQuotesDB, globalQuotesDB, addQuote as addQuoteToStatic } from '../../data/staticData';

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve as () => void, ms));


class QuoteService {
    async getQuotes(): Promise<Quote[]> {
        await delay(500);
        // Combine local and global quotes for the feed
        // casting to specific type if needed or ensure staticData matches types
        // The staticData has slightly different structure (e.g. 'time' vs 'date'), we map it here.

        const combined = [...localQuotesDB, ...globalQuotesDB].map(q => {
            // Map to uniform Quote type
            return {
                id: q.id,
                text: q.text,
                book: q.book,
                author: q.author,
                theme: (q as any).theme || undefined,
                likes: q.likes,
                isLiked: q.isLiked,
                user: (q as any).user, // might be undefined for local quotes in current staticData
                date: (q as any).date || (q as any).time,
                isSaved: (q as any).isSaved,
                comments: (q as any).comments,
                blockData: (q as any).blockData || {},
            } as Quote;
        });

        return combined;
    }

    async getQuoteById(id: number): Promise<Quote | undefined> {
        await delay(300);
        const quotes = await this.getQuotes();
        return quotes.find(q => q.id === id);
    }

    async toggleLike(id: number): Promise<Quote | undefined> {
        await delay(200);
        // In a real app, this would call an API. 
        // Here we find the object in memory and mutate it (since it's a reference) 
        // or return a new one. mutation of imported static vars is possible but tricky in modules.
        // For this 'functional' step, returning a simulated updated quote is enough for the State to update.

        const quotes = await this.getQuotes();
        const quote = quotes.find(q => q.id === id);
        if (quote) {
            quote.isLiked = !quote.isLiked;
            quote.likes += quote.isLiked ? 1 : -1;
        }
        return quote;
    }

    async deleteQuote(id: number): Promise<void> {
        await delay(300);
        // Simulate deletion from local DB
        // We can't easily mutate the imported array and have it stick across reloads of the service 
        // if we were just reading it, but since we are modifying the 'staticData' module in memory...
        const index = localQuotesDB.findIndex(q => q.id === id);
        if (index > -1) {
            localQuotesDB.splice(index, 1);
        }
        // logic for global? normally we don't delete other ppl's quotes
    }

    async addQuote(text: string, book: string, author: string): Promise<void> {
        await delay(500);
        addQuoteToStatic({ text, book, author });
    }

    async updateQuote(id: number, updates: Partial<Quote>): Promise<void> {
        await delay(300);
        // Update in local DB
        const localQuote = localQuotesDB.find(q => q.id === id);
        if (localQuote) {
            Object.assign(localQuote, updates);
        }

        // Update in global DB
        const globalQuote = globalQuotesDB.find(q => q.id === id);
        if (globalQuote) {
            Object.assign(globalQuote, updates);
        }
    }
}

export const quoteService = new QuoteService();
