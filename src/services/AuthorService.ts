import { Author, Book } from '../../types';
import { authorDetails, bookDescriptions } from '../../data/staticData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve as () => void, ms));


class AuthorService {
    async getAuthors(): Promise<Author[]> {
        await delay(500);
        return Object.entries(authorDetails).map(([name, detail]) => ({
            name,
            ...detail
        }));
    }

    async getAuthorByName(name: string): Promise<Author | undefined> {
        await delay(300);
        const detail = authorDetails[name];
        if (!detail) return undefined;
        return { name, ...detail };
    }

    async getBooksByAuthor(authorName: string): Promise<Book[]> {
        await delay(300);
        // Filter bookDescriptions by author
        return Object.entries(bookDescriptions)
            .filter(([_, book]) => book.author === authorName)
            .map(([title, book]) => ({
                title,
                ...book
            }));
    }
}

export const authorService = new AuthorService();
