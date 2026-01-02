
interface GoogleBookVolume {
    id: string;
    volumeInfo: {
        title: string;
        authors?: string[];
        description?: string;
        publishedDate?: string;
        pageCount?: number;
        categories?: string[];
        imageLinks?: {
            thumbnail?: string;
            smallThumbnail?: string;
        };
        industryIdentifiers?: Array<{ type: string; identifier: string }>;
    };
}

export interface FormattedBook {
    googleId: string;
    title: string;
    authors: string[];
    description: string;
    year: number | null;
    pages: number | null;
    cover: string | null;
    genre: string | null;
    isbn: string | null;
}

export const searchGoogleBooks = async (query: string): Promise<FormattedBook[]> => {
    if (!query) return [];

    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20`);

        if (!response.ok) {
            throw new Error(`Google Books API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.items) return [];

        return data.items.map((item: GoogleBookVolume) => {
            const info = item.volumeInfo;

            // Extract ISBN-13 if available, otherwise 10
            const isbnObj = info.industryIdentifiers?.find(id => id.type === 'ISBN_13')
                || info.industryIdentifiers?.find(id => id.type === 'ISBN_10');

            return {
                googleId: item.id,
                title: info.title,
                authors: info.authors || ['Unknown Author'],
                description: info.description || '',
                year: info.publishedDate ? parseInt(info.publishedDate.substring(0, 4)) : null,
                pages: info.pageCount || null,
                cover: info.imageLinks?.thumbnail?.replace('http:', 'https:') || null, // Ensure HTTPS
                genre: info.categories?.[0] || null,
                isbn: isbnObj?.identifier || null
            };
        });
    } catch (error) {
        console.error('Error searching Google Books:', error);
        return [];
    }
};
