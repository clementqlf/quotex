import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { loadBookDetailData } from '@/src/entities/book/lib/loadBookDetailData';
import { Author, Book } from '@/src/shared/api/types';
import { useBookRealtime, useAuthorRealtime } from '@/src/shared/lib/hooks/useRealtimeEntity';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Dispatch, SetStateAction, useState, useEffect, useMemo } from 'react';

export interface BookDataResult {
  bookInfo: Book | null;
  authorInfo: Author | null;
  isLoadingMetadata: boolean;
  isImporting: boolean;
  bookId: number | undefined;
  bookTitleParam: string | undefined;
  inventaireUriParam: string | undefined;
  bookCoverParam: string | undefined;
  setIsImporting: Dispatch<SetStateAction<boolean>>;
  setBookInfo: Dispatch<SetStateAction<Book | null>>;
  setAuthorInfo: Dispatch<SetStateAction<Author | null>>;
  reloadBookData: () => void;
}

export const useBookData = (): BookDataResult => {
  const rawParams = useLocalSearchParams<{ 
    bookId?: string; 
    bookTitle?: string; 
    inventaireUri?: string; 
    bookData?: string; 
    cover?: string 
  }>();
  
  const bookId = rawParams.bookId ? Number(rawParams.bookId) : undefined;
  const bookTitleParam = rawParams.bookTitle as string | undefined;
  const inventaireUriParam = rawParams.inventaireUri as string | undefined;
  const bookCoverParam = rawParams.cover as string | undefined;

  const { 
    getBookById,
    getBookByTitle,
    getBookByInventaireUri,
    importBook,
    getAuthorByName,
  } = useAuthor();

  const [bookInfo, setBookInfo] = useState<Book | null>(null);
  const [authorInfo, setAuthorInfo] = useState<Author | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  // Load book and author data using TanStack Query
  const { data: bookData, isLoading: isLoadingQuery, refetch } = useQuery({
    queryKey: ['book-detail', bookId, bookTitleParam, inventaireUriParam],
    queryFn: () => loadBookDetailData({
      bookId,
      bookTitle: bookTitleParam,
      inventaireUri: inventaireUriParam,
      bookCover: bookCoverParam,
      bookData: rawParams.bookData,
      getBookById,
      getBookByTitle,
      getBookByInventaireUri,
      importBook,
      getAuthorByName,
    }),
    enabled: !!bookId || !!bookTitleParam,
    staleTime: 5 * 60 * 1000
  });

  // Adjust state during render when book key or data changes to avoid visual flash and keep states synced
  const currentBookKey = `${bookId}_${bookTitleParam}_${inventaireUriParam}`;
  const [prevBookKey, setPrevBookKey] = useState<string | null>(null);
  const [prevBookData, setPrevBookData] = useState<any>(null);

  if (currentBookKey !== prevBookKey || bookData !== prevBookData) {
    setPrevBookKey(currentBookKey);
    setPrevBookData(bookData);
    setBookInfo(bookData?.book || null);
    setAuthorInfo(bookData?.author || null);
  }

  // Set isNavigationReady to true on next tick to allow params to be resolved
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const isLoadingMetadata = !isNavigationReady || isLoadingQuery || isImporting;

  const resolvedBookInfo = bookInfo || bookData?.book || null;
  const resolvedAuthorInfo = authorInfo || bookData?.author || null;

  // Subscribe to realtime entity changes to catch asynchronous server enrichment updates
  const realtimeBook = useBookRealtime(resolvedBookInfo?.id, resolvedBookInfo);
  const realtimeAuthor = useAuthorRealtime(resolvedAuthorInfo?.id, resolvedAuthorInfo);

  // Invalidate query when enrichment completes to sync TanStack query cache
  useEffect(() => {
    if (realtimeBook && !realtimeBook.isEnriching && resolvedBookInfo?.isEnriching) {
      console.log('[Realtime] Book enrichment complete, refetching query data...');
      refetch();
    }
  }, [realtimeBook?.isEnriching, resolvedBookInfo?.isEnriching, refetch]);

  useEffect(() => {
    if (realtimeAuthor && !realtimeAuthor.isEnriching && resolvedAuthorInfo?.isEnriching) {
      console.log('[Realtime] Author enrichment complete, refetching query data...');
      refetch();
    }
  }, [realtimeAuthor?.isEnriching, resolvedAuthorInfo?.isEnriching, refetch]);

  // Merge realtime updates with resolved database data to preserve relations (like author)
  // that are missing from raw table payloads in realtime.
  const mergedBookInfo = useMemo(() => {
    const baseBook = resolvedBookInfo;
    if (!baseBook) return null;
    if (!realtimeBook) return baseBook;
    
    // Only keep previous author object if the authorId didn't change
    const author = ((realtimeBook as any).authorId === (baseBook as any).authorId)
      ? baseBook.author
      : realtimeBook.author || baseBook.author;

    return {
      ...baseBook,
      ...realtimeBook,
      author,
      similarBooks: baseBook.similarBooks || realtimeBook.similarBooks || [],
    } as Book;
  }, [resolvedBookInfo, realtimeBook]);

  const mergedAuthorInfo = useMemo(() => {
    const baseAuthor = resolvedAuthorInfo;
    if (!baseAuthor) return null;
    if (!realtimeAuthor) return baseAuthor;
    return {
      ...baseAuthor,
      ...realtimeAuthor,
      similarAuthors: baseAuthor.similarAuthors || realtimeAuthor.similarAuthors || [],
    } as Author;
  }, [resolvedAuthorInfo, realtimeAuthor]);

  return {
    bookInfo: mergedBookInfo,
    authorInfo: mergedAuthorInfo,
    isLoadingMetadata,
    isImporting,
    bookId,
    bookTitleParam,
    inventaireUriParam,
    bookCoverParam,
    setIsImporting,
    setBookInfo,
    setAuthorInfo,
    reloadBookData: refetch,
  };
};
