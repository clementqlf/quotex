import { useQuery, useMutation } from '@tanstack/react-query';
import { httpClient } from '@/src/shared/api/HttpClient';
import { Book } from '@/src/shared/api/types';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';
import { BookSearchResult } from '../api/BookSearchService';
import { useNetInfo } from '@react-native-community/netinfo';

/**
 * Hook pour rechercher des livres
 * Gère automatiquement le fallback offline (retourne tableau vide)
 */
export const useBookSearch = (query: string) => {
  const netInfo = useNetInfo();
  const isOfflineStatus = netInfo.isConnected === false;

  return useQuery({
    queryKey: ['book-search', query, isOfflineStatus],
    queryFn: async () => {
      if (!query.trim()) return [];
      const results = await httpClient.get<BookSearchResult[]>(`/book-search/search?q=${encodeURIComponent(query)}`);
      return results;
    },
    enabled: !!query.trim() && !isOfflineStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook pour importer un livre
 */
export const useImportBook = () => {
  
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
