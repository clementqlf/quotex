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

export interface OpenLibraryAuthor {
    key: string;
    name: string;
    birth_date?: string;
    top_work?: string;
    work_count?: number;
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

export const searchOpenLibraryAuthors = async (query: string): Promise<OpenLibraryAuthor[]> => {
    if (!query) return [];
    try {
        const response = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(query)}&limit=5`);
        if (!response.ok) throw new Error(`OpenLibrary API error: ${response.statusText}`);
        const data = await response.json();
        return data.docs || [];
    } catch (e) {
        console.error('Error searching OpenLibrary authors:', e);
        return [];
    }
};
