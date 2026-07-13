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

  if (!query || !query.trim()) {
    return [];
  }

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${limit}&langRestrict=fr&key=${apiKey}`;
    console.log(`[GoogleBooks] Searching for "${query}" (limit: ${limit})`);
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "QuotexApp/1.0 (contact: support@quotex.app)"
      }
    });

    if (!res.ok) {
      console.warn(`[GoogleBooks] API warning: ${res.status} ${res.statusText}`);
      if (throwOnError) throw new Error(`Google Books API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const items = data.items || [];

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
    if (throwOnError) throw e;
    console.error("[GoogleBooks] Unexpected error during search:", e);
    return [];
  }
};
