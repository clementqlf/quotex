import { Quote } from '../../types';
import { Platform } from 'react-native';
import { localQuotesDB, globalQuotesDB, addQuote as addQuoteToStatic } from '../../data/staticData';
import { StorageService, STORAGE_KEYS } from './StorageService';

import { API_BASE_URL } from '../config/api';

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
                likesCount: (q as any).likesCount || ((q as any).likes && typeof (q as any).likes === 'number' ? (q as any).likes : 0),
                likes: [], // Static data doesn't have partial likes relation array usually
                isLiked: q.isLiked,
                user: (q as any).user || { id: "1", name: "Clément QLF", username: "@clementqlf" },
                date: (q as any).date || (q as any).time,
                isSaved: (q as any).isSaved,
                comments: (q as any).comments,
                blockData: (q as any).blockData || {},
            } as Quote));
            await StorageService.setItem(STORAGE_KEYS.QUOTES, initialQuotes);
        }
    }

    // Use centralized API config
    private readonly API_URL = `${API_BASE_URL}/quotes`;



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

                const mappedQuotes: Quote[] = serverQuotes.map((q: any) => ({
                    id: q.id,
                    text: q.text,
                    book: q.book,
                    author: q.author,
                    theme: q.theme,
                    likesCount: q.likesCount || 0,
                    isLiked: q.isLiked || false,
                    date: q.date || new Date().toISOString(),
                    time: q.date ? new Date(q.date).toLocaleDateString() : "Aujourd'hui",
                    isSaved: q.isSaved || false,
                    comments: q.comments || 0,
                    blockData: q.blockData || {},
                    user: q.user,
                    aiInterpretation: q.aiInterpretation,
                    definitions: q.definitions ? JSON.parse(q.definitions) : undefined,
                }));

                // Update local cache
                await StorageService.setItem(STORAGE_KEYS.QUOTES, mappedQuotes);

                // Trigger sync of pending quotes in background
                this.syncPendingQuotes();

                return mappedQuotes;
            }
        } catch (error) {
            console.log('Server unreachable, using local storage:', error);
        }

        // Fallback to local storage (offline mode)
        await delay(500);
        await this.seedDataIfNeeded();
        const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES);

        // Ensure all legacy quotes have a user
        const safeQuotes = (quotes || []).map(q => ({
            ...q,
            user: q.user || { id: "1", name: "Clément QLF", username: "@clementqlf" }
        }));

        return safeQuotes;
    }

    async getQuoteById(id: number): Promise<Quote | undefined> {
        // Try fetching from server first
        try {
            console.log(`Fetching quote ${id} from server...`);
            const response = await fetch(`${this.API_URL}/${id}`);
            if (response.ok) {
                const q = await response.json();
                console.log('Quote fetched successfully:', q.id);

                const mappedQuote: Quote = {
                    id: q.id,
                    text: q.text,
                    book: q.book,
                    author: q.author,
                    theme: q.theme,
                    likesCount: q.likesCount || 0,
                    isLiked: q.isLiked || false,
                    date: q.date || new Date().toISOString(),
                    time: q.date ? new Date(q.date).toLocaleDateString() : "Aujourd'hui",
                    isSaved: q.isSaved || false,
                    comments: q.comments || 0,
                    blockData: q.blockData || {},
                    user: q.user,
                    aiInterpretation: q.aiInterpretation,
                    definitions: q.definitions ? (typeof q.definitions === 'string' ? JSON.parse(q.definitions) : q.definitions) : undefined,
                };

                // Update strictly this quote in local cache to ensure consistency
                const currentQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
                const updatedQuotes = currentQuotes.map(cq => cq.id === id ? mappedQuote : cq);
                // If it's a new quote not in list (unlikely via navigation but possible), add it? 
                // For now, just update if exists.
                await StorageService.setItem(STORAGE_KEYS.QUOTES, updatedQuotes);

                return mappedQuote;
            }
        } catch (error) {
            console.log('Error fetching quote by ID, using local fallback:', error);
        }

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
            quote.likesCount += quote.isLiked ? 1 : -1;
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
                // Could also update cache here
            }
        } catch (error) {
            console.error('Network error deleting quote:', error);
        }

        // Optimistic local delete
        await delay(300);
        const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
        const newQuotes = quotes.filter(q => q.id !== id);
        await StorageService.setItem(STORAGE_KEYS.QUOTES, newQuotes);
    }

    async addQuote(text: string, book: string, author: string): Promise<void> {
        const quotePayload = { text, book, author };
        try {
            console.log('Sending quote to server:', quotePayload);
            const response = await fetch(this.API_URL!, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(quotePayload),
            });

            if (response.ok) {
                console.log('Quote saved to server');
                return;
            } else {
                console.error('Server error saving quote:', await response.text());
                // Decide if we should queue on server error (500) or just network error. 
                // For now, let's queue on any failure to be safe, or maybe just network. 
                // Simple approach: if not OK, queue it.
                await this.addToPendingQueue(quotePayload);
            }
        } catch (error) {
            console.error('Network error saving quote, queueing for sync:', error);
            await this.addToPendingQueue(quotePayload);
        }

        // Update local cache optimistically
        await delay(100);
        const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
        const newQuote: Quote = {
            id: Date.now(), // Temp ID
            text,
            book,
            author,
            likesCount: 0,
            likes: [], // Initialize empty likes array for new quote
            isLiked: false,
            date: new Date().toISOString(),
            isSaved: false,
            comments: 0,
            blockData: {},
            user: { id: 1, name: "Clément QLF", username: "@clementqlf" }
        };
        const updatedQuotes = [newQuote, ...quotes];
        await StorageService.setItem(STORAGE_KEYS.QUOTES, updatedQuotes);
    }

    private async addToPendingQueue(payload: { text: string; book: string; author: string }) {
        const pending = await StorageService.getItem<any[]>(STORAGE_KEYS.PENDING_QUOTES) || [];
        pending.push(payload);
        await StorageService.setItem(STORAGE_KEYS.PENDING_QUOTES, pending);
        console.log('Quote added to pending queue');
    }

    private async syncPendingQuotes() {
        const pending = await StorageService.getItem<any[]>(STORAGE_KEYS.PENDING_QUOTES);
        if (!pending || pending.length === 0) return;

        console.log(`Syncing ${pending.length} pending quotes...`);
        const remaining: any[] = [];

        for (const quote of pending) {
            try {
                const response = await fetch(this.API_URL!, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(quote),
                });
                if (!response.ok) {
                    remaining.push(quote);
                    console.log('Failed to sync quote, keeping in queue');
                } else {
                    console.log('Synced quote successfully');
                }
            } catch (e) {
                remaining.push(quote);
                console.log('Network error syncing quote, keeping in queue');
            }
        }

        if (remaining.length !== pending.length) {
            await StorageService.setItem(STORAGE_KEYS.PENDING_QUOTES, remaining);
            console.log('Sync complete. Remaining items:', remaining.length);
        }
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

    async getUserByUsername(username: string): Promise<any | undefined> {
        try {
            const baseUrl = this.API_URL!.replace('/quotes', '');
            // Strip @ if present in URL segment to avoid double encoding or issues, handled by server anyway
            const cleanUsername = username.replace('@', '');
            const response = await fetch(`${baseUrl}/users/${cleanUsername}`);

            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.log('Error fetching user:', e);
        }
        return undefined;
    }
}

export const quoteService = new QuoteService();
