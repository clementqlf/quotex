import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '@/src/shared/api/HttpClient';
import { Book } from '@/src/shared/api/types';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';
import { BookSearchResult } from '../api/BookSearchService';

/**
 * Hook pour rechercher des livres
 * Gère automatiquement le fallback offline (retourne tableau vide)
 */
export const useBookSearch = (query: string) => {
  return useQuery({
    queryKey: ['book-search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const results = await httpClient.get<BookSearchResult[]>(`/book-search/search?q=${encodeURIComponent(query)}`);
      return results;
    },
    enabled: !!query.trim() && !isOffline(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook pour importer un livre
 */
export const useImportBook = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bookData: BookSearchResult) => {
      if (await isOffline()) {
        throw new Error('Offline - cannot import book');
      }
      return await httpClient.post<Book>('/books/import', bookData);
    },
    onError: (error) => {
      logFetchError('Error importing book', error);
    },
  });
};
