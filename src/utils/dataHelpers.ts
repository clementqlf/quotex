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

export const STATUS_OPTIONS = [
  { label: 'Lu', value: 'READ', color: '#10B981' },
  { label: 'À lire', value: 'TO_READ', color: '#3B82F6' },
  { label: 'En cours de lecture', value: 'READING', color: '#F59E0B' },
  { label: 'Pas fini', value: 'DROPPED', color: '#EF4444' },
];

export const getStatusLabel = (status?: string) => {
  const option = STATUS_OPTIONS.find(o => o.value === status);
  return option ? option.label : status || '';
};

export const getStatusColor = (status?: string) => {
  const option = STATUS_OPTIONS.find(o => o.value === status);
  return option ? option.color : '#9CA3AF';
};
