
interface GoogleBookVolume {
    id: string;
    volumeInfo: {
        title: string;
        authors?: string[];
        description?: string;
        publishedDate?: string;
        pageCount?: number;
        categories?: string[];
        averageRating?: number;
        imageLinks?: {
            thumbnail?: string;
            smallThumbnail?: string;
        };
        industryIdentifiers?: Array<{ type: string; identifier: string }>;
    };
    saleInfo?: {
        buyLink?: string;
        listPrice?: {
            amount: number;
            currencyCode: string;
        };
        retailPrice?: {
            amount: number;
            currencyCode: string;
        };
    };
}

export interface FormattedBook {
    googleId: string;
    openLibraryId?: string;
    authorOpenLibraryId?: string;
    title: string;
    authors: string[];
    description: string;
    year: number | null;
    pages: number | null;
    cover: string | null;
    genre: string | null;
    isbn: string | null;
    rating: number | null;
    buyLink: string | null;
    price: string | null;
}

// ---------------------------------------------------------------------------
// Rate-limiting helpers
// ---------------------------------------------------------------------------

/** Minimum delay between consecutive Google Books requests (ms) */
const MIN_REQUEST_INTERVAL_MS = 500;

/** How many requests can run in parallel */
const MAX_CONCURRENT = 1;

let activeRequests = 0;
let lastRequestTime = 0;
const requestQueue: Array<() => void> = [];

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Acquire a "slot" before sending a request.
 * Ensures MAX_CONCURRENT limit and MIN_REQUEST_INTERVAL_MS spacing.
 */
const acquireSlot = (): Promise<void> =>
    new Promise(resolve => {
        const tryAcquire = () => {
            if (activeRequests < MAX_CONCURRENT) {
                const now = Date.now();
                const elapsed = now - lastRequestTime;
                const delay = Math.max(0, MIN_REQUEST_INTERVAL_MS - elapsed);
                activeRequests++;
                lastRequestTime = now + delay;
                wait(delay).then(resolve);
            } else {
                requestQueue.push(tryAcquire);
            }
        };
        tryAcquire();
    });

const releaseSlot = () => {
    activeRequests--;
    const next = requestQueue.shift();
    if (next) next();
};

// ---------------------------------------------------------------------------
// Fetch with exponential backoff on 429
// ---------------------------------------------------------------------------

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 1000;

const fetchWithBackoff = async (url: string): Promise<Response> => {
    let attempt = 0;
    while (true) {
        await acquireSlot();
        try {
            const response = await fetch(url);
            if (response.status === 429) {
                releaseSlot();
                if (attempt >= MAX_RETRIES) {
                    throw new Error(`Google Books API error: Too Many Requests (gave up after ${MAX_RETRIES} retries)`);
                }
                const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
                console.warn(`[GoogleBooks] Rate limited (429). Retrying in ${backoff}ms… (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await wait(backoff);
                attempt++;
                continue;
            }
            releaseSlot();
            return response;
        } catch (err) {
            releaseSlot();
            throw err;
        }
    }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const searchGoogleBooks = async (query: string): Promise<FormattedBook[]> => {
    if (!query) return [];

    try {
        const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
        const keyParam = apiKey ? `&key=${apiKey}` : '';
        const response = await fetchWithBackoff(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20${keyParam}`
        );

        if (!response.ok) {
            throw new Error(`Google Books API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.items) return [];

        return data.items.map((item: GoogleBookVolume) => {
            const info = item.volumeInfo;
            const sale = item.saleInfo;

            // Extract ISBN-13 if available, otherwise 10
            const isbnObj = info.industryIdentifiers?.find(id => id.type === 'ISBN_13')
                || info.industryIdentifiers?.find(id => id.type === 'ISBN_10');

            // Format price if available
            let priceString = null;
            if (sale?.retailPrice) {
                priceString = `${sale.retailPrice.amount} ${sale.retailPrice.currencyCode}`;
            } else if (sale?.listPrice) {
                priceString = `${sale.listPrice.amount} ${sale.listPrice.currencyCode}`;
            }

            return {
                googleId: item.id,
                title: info.title,
                authors: info.authors || ['Unknown Author'],
                description: info.description || '',
                year: info.publishedDate ? parseInt(info.publishedDate.substring(0, 4)) : null,
                pages: info.pageCount || null,
                cover: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null, // Ensure HTTPS
                genre: info.categories?.[0] || null,
                isbn: isbnObj?.identifier || null,
                rating: info.averageRating || null,
                buyLink: sale?.buyLink || null,
                price: priceString
            };
        });
    } catch (error) {
        console.error('Error searching Google Books:', error);
        return [];
    }
};

export const getSimilarBooks = async (genre: string | null, author: string | null, currentGoogleId: string): Promise<FormattedBook[]> => {
    try {
        let query = '';
        if (genre) {
            query = `subject:${genre}`;
        } else if (author) {
            query = `inauthor:${author}`;
        } else {
            return [];
        }

        const books = await searchGoogleBooks(query);
        // Filter out the current book
        return books.filter(b => b.googleId !== currentGoogleId).slice(0, 5);
    } catch (error) {
        console.error('Error fetching similar books:', error);
        return []
    }
};
