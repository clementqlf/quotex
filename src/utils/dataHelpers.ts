import { Book, Author } from '../../types';

export const getBookTitle = (book: string | Book | undefined | null): string => {
    if (!book) return 'Livre inconnu';
    if (typeof book === 'string') return book;
    return book.title;
};

export const getAuthorName = (author: string | Author | undefined | null): string => {
    if (!author) return 'Auteur inconnu';
    if (typeof author === 'string') return author;
    return author.name;
};
