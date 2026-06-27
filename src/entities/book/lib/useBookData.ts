import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { loadBookDetailData } from '@/src/entities/book/lib/loadBookDetailData';
import { Author, Book } from '@/src/shared/api/types';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Dispatch, SetStateAction, useState, useEffect } from 'react';

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

  const isLoadingMetadata = isLoadingQuery || isImporting;

  const resolvedBookInfo = bookInfo || bookData?.book || null;
  const resolvedAuthorInfo = authorInfo || bookData?.author || null;

  return {
    bookInfo: resolvedBookInfo,
    authorInfo: resolvedAuthorInfo,
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
