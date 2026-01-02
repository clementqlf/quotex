export interface OpenLibraryWork {
    key: string;
    title: string;
    author_name?: string[];
    first_publish_year?: number;
    cover_i?: number;
    isbn?: string[];
    edition_count?: number;
    author_key?: string[];
}

export const searchOpenLibraryWorks = async (query: string): Promise<OpenLibraryWork[]> => {
    if (!query) return [];
    try {
        const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`);
        if (!response.ok) throw new Error(`OpenLibrary API error: ${response.statusText}`);
        const data = await response.json();
        return data.docs || [];
    } catch (e) {
        console.error('Error searching OpenLibrary:', e);
        return [];
    }
};
