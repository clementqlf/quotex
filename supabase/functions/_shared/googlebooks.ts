export interface GoogleBookSearchResult {
  id: string;
  uri: string;
  type: string;
  label: string;
  title: string;
  image: string | null;
  cover: string | null;
  authors: string[];
  description: string;
  googleId: string;
  isbn: string | null;
  year: number | null;
  pages: number | null;
  genre: string | null;
}

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const computeRetryDelayMs = (attempt: number): number => {
  const exponential = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 150);
  return exponential + jitter;
};

/**
 * Searches Google Books API using the configured secret key.
 * Strictly requires the GOOGLE_BOOKS_API_KEY environment variable.
 */
export const searchGoogleBooks = async (query: string, limit = 10, throwOnError = false): Promise<GoogleBookSearchResult[]> => {
  const apiKey = Deno.env.get("GOOGLE_BOOKS_API_KEY");
  if (!apiKey) {
    console.error("[GoogleBooks] Error: GOOGLE_BOOKS_API_KEY environment variable is not set.");
    throw new Error("GOOGLE_BOOKS_API_KEY is not configured on the server.");
  }

  // Sanitize query string: replace curly apostrophes and strip duplicate outer quotes
  const cleanQuery = query
    .replace(/[’‘`]/g, "'")
    .replace(/^"+|"+$/g, '')
    .trim();

  if (!cleanQuery) {
    return [];
  }

  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQuery)}&printType=books&maxResults=${limit}&langRestrict=fr&key=${apiKey}`;
  console.log(`[GoogleBooks] Searching for "${cleanQuery}" (limit: ${limit})`);

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    const attemptNumber = attempt + 1;
    const totalAttempts = MAX_RETRY_ATTEMPTS + 1;

    try {
      console.log(`[GoogleBooks] Attempt ${attemptNumber}/${totalAttempts} for query "${query}"`);
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!res.ok) {
        const retryable = RETRYABLE_STATUS_CODES.has(res.status);
        const hasRetryLeft = attempt < MAX_RETRY_ATTEMPTS;

        if (retryable && hasRetryLeft) {
          const delayMs = computeRetryDelayMs(attempt);
          console.warn(`[GoogleBooks] Transient HTTP ${res.status} on attempt ${attemptNumber}/${totalAttempts}. Retrying in ${delayMs}ms.`);
          await wait(delayMs);
          continue;
        }

        console.warn(`[GoogleBooks] API warning: ${res.status} ${res.statusText} (attempt ${attemptNumber}/${totalAttempts})`);
        if (throwOnError) throw new Error(`Google Books API error: ${res.status}`);
        return [];
      }

      const data = await res.json();
      const rawItems = data.items || [];
      const items = rawItems.filter((item: { volumeInfo?: { printType?: string; categories?: string[]; title?: string; authors?: string[]; industryIdentifiers?: { type: string; identifier: string }[] } }) => {
        const info = item.volumeInfo || {};
        const printType = info.printType;
        if (printType && printType !== "BOOK") return false;

        const categories = (Array.isArray(info.categories) ? info.categories : []).map((c) => String(c).toLowerCase());
        const nonBookCategories = [
          "periodicals", "magazines", "newspapers", "directories", 
          "serials", "government publications", "registers", "yearbooks", "catalogs"
        ];
        if (categories.some((cat) => nonBookCategories.some((nb) => cat.includes(nb)))) {
          return false;
        }

        // Option A: Strictly require an ISBN (ISBN_13 or ISBN_10) for Google Books items
        const hasIsbn = Array.isArray(info.industryIdentifiers) && info.industryIdentifiers.some((id: { type?: string }) => id?.type === "ISBN_13" || id?.type === "ISBN_10");
        if (!hasIsbn) {
          return false;
        }

        return true;
      });
      console.log(`[GoogleBooks] Success on attempt ${attemptNumber}/${totalAttempts}. Results: ${items.length}`);

      return items.map((item: any) => {
        const info = item.volumeInfo || {};

        // Parse ISBN
        let isbn: string | null = null;
        if (Array.isArray(info.industryIdentifiers)) {
          // Prefer ISBN_13, fallback to ISBN_10
          const isbn13 = info.industryIdentifiers.find((id: any) => id.type === "ISBN_13");
          const isbn10 = info.industryIdentifiers.find((id: any) => id.type === "ISBN_10");
          isbn = isbn13?.identifier || isbn10?.identifier || null;
        }

        // Parse publication year
        let year: number | null = null;
        if (info.publishedDate) {
          const match = String(info.publishedDate).match(/^(\d{4})/);
          if (match) {
            year = parseInt(match[1]);
          }
        }

        // Cover image URL (convert to HTTPS if HTTP is returned)
        let coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
        if (coverUrl && coverUrl.startsWith("http://")) {
          coverUrl = coverUrl.replace("http://", "https://");
        }

        return {
          id: item.id,
          uri: `googlebooks:${item.id}`,
          type: "work",
          label: info.title || "Livre sans titre",
          title: info.title || "Livre sans titre",
          image: coverUrl,
          cover: coverUrl,
          authors: Array.isArray(info.authors) ? info.authors : [],
          description: info.description || "",
          googleId: item.id,
          isbn: isbn,
          year: year,
          pages: info.pageCount || null,
          genre: Array.isArray(info.categories) && info.categories.length > 0 ? info.categories[0] : null,
        };
      });
    } catch (e) {
      const hasRetryLeft = attempt < MAX_RETRY_ATTEMPTS;

      if (hasRetryLeft) {
        const delayMs = computeRetryDelayMs(attempt);
        console.warn(`[GoogleBooks] Network/unknown error on attempt ${attemptNumber}/${totalAttempts}. Retrying in ${delayMs}ms.`, e);
        await wait(delayMs);
        continue;
      }

      if (throwOnError) throw e;
      console.error(`[GoogleBooks] Unexpected error during search after ${totalAttempts} attempts:`, e);
      return [];
    }
  }

  return [];
};
