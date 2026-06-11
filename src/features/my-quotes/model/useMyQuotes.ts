import { useAuth } from '@/src/app/providers/AuthContext';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { Book } from '@/src/shared/api/types';
import { useCallback, useMemo } from 'react';

/**
 * Hook feature pour la gestion des citations de l'utilisateur
 * Découple la page MyQuotesScreen des providers
 */
export const useMyQuotes = () => {
  const { 
    quotes: allQuotes, 
    toggleLikeQuote, 
    deleteQuote: deleteQuoteFromProvider, 
    refreshQuotes 
  } = useQuote();
  
  const { 
    authors: allAuthors, 
    books: allBooks,
    refreshAuthors, 
    refreshBooks 
  } = useAuthor();
  
  const { user: currentUser } = useAuth();

  // Filtre les quotes de l'utilisateur courant
  const myQuotes = useMemo(() => {
    return allQuotes.filter(q => q.user?.id === currentUser?.id);
  }, [allQuotes, currentUser]);

  // Rafraîchissement des données
  const refreshMyQuotes = useCallback(async () => {
    await Promise.all([
      refreshQuotes(),
      refreshAuthors(),
      refreshBooks()
    ]);
  }, [refreshQuotes, refreshAuthors, refreshBooks]);

  // Toggle like avec optimisation
  const toggleLike = useCallback(async (quoteId: number) => {
    await toggleLikeQuote(quoteId);
  }, [toggleLikeQuote]);

  // Suppression d'une citation
  const removeQuote = useCallback(async (quoteId: number) => {
    await deleteQuoteFromProvider(quoteId);
  }, [deleteQuoteFromProvider]);

  // Obtenir le nombre de livres uniques
  const getBookCount = useCallback(() => {
    return new Set(myQuotes.map(q => {
      if (typeof q.book === 'object' && q.book !== null) {
        return q.book.title;
      }
      return q.book as string;
    })).size;
  }, [myQuotes]);

  // Obtenir la liste des auteurs uniques
  const getAuthors = useCallback(() => {
    const authors = new Set<string>();
    myQuotes.forEach(q => {
      if (typeof q.author === 'object' && q.author !== null) {
        authors.add(q.author.name);
      } else if (typeof q.author === 'string') {
        authors.add(q.author);
      }
    });
    return Array.from(authors);
  }, [myQuotes]);

  // Obtenir la liste des livres avec leurs métadonnées
  const getBooksData = useCallback(() => {
    const grouped: Record<string, { 
      authors: Set<string>; 
      quoteCount: number; 
      bookObj?: Book 
    }> = {};

    myQuotes.forEach(quote => {
      const title = typeof quote.book === 'object' && quote.book !== null 
        ? quote.book.title 
        : quote.book as string;
      const author = typeof quote.author === 'object' && quote.author !== null 
        ? quote.author.name 
        : quote.author as string;
      
      if (!grouped[title]) {
        grouped[title] = { authors: new Set(), quoteCount: 0 };
      }
      grouped[title].authors.add(author);
      grouped[title].quoteCount += 1;
      
      if (quote.book && typeof quote.book !== 'string') {
        grouped[title].bookObj = quote.book;
      }
    });

    // Intégrer les livres sauvegardés par l'utilisateur
    allBooks.forEach(book => {
      if (grouped[book.title]) {
        grouped[book.title].bookObj = book;
      } else if (book.isSaved) {
        const authorName = typeof book.author === 'object' && book.author !== null 
          ? book.author.name 
          : book.author as string;
        grouped[book.title] = {
          authors: new Set([authorName]),
          quoteCount: 0,
          bookObj: book
        };
      }
    });

    return Object.entries(grouped).map(([bookTitle, data]) => ({
      title: bookTitle,
      id: data.bookObj?.id,
      authors: Array.from(data.authors),
      quoteCount: data.quoteCount,
      year: data.bookObj?.year,
      description: data.bookObj?.description,
      cover: data.bookObj?.cover,
      readingStatus: data.bookObj?.readingStatus,
      inventaireUri: data.bookObj?.inventaireUri,
    }));
  }, [myQuotes, allBooks]);

  // Obtenir les données auteurs
  const getAuthorsData = useCallback(() => {
    const grouped: Record<string, { author: any; quoteCount: number }> = {};

    myQuotes.forEach(quote => {
      const name = typeof quote.author === 'object' && quote.author !== null 
        ? quote.author.name 
        : quote.author as string;
      
      if (!grouped[name]) {
        grouped[name] = { author: quote.author, quoteCount: 0 };
      } else if (typeof grouped[name].author === 'string' && typeof quote.author !== 'string') {
        grouped[name].author = quote.author;
      }
      grouped[name].quoteCount += 1;
    });

    // Intégrer les auteurs sauvegardés
    allAuthors.forEach(author => {
      if (author.isSaved && !grouped[author.name]) {
        grouped[author.name] = { author: author, quoteCount: 0 };
      }
    });

    return Object.values(grouped).map((data: any) => ({
      name: typeof data.author === 'object' && data.author !== null 
        ? data.author.name 
        : data.author as string,
      image: typeof data.author !== 'string' ? data.author?.image : null,
      quoteCount: data.quoteCount,
      inventaireUri: typeof data.author !== 'string' ? data.author?.inventaireUri : undefined,
    }));
  }, [myQuotes, allAuthors]);

  // Obtenir les thèmes
  const getThemes = useCallback(() => {
    const grouped: Record<string, { books: Set<string>; quoteCount: number }> = {};
    
    myQuotes.forEach(q => {
      const theme = q.theme || 'Thème non renseigné';
      if (!grouped[theme]) {
        grouped[theme] = { books: new Set(), quoteCount: 0 };
      }
      
      const bookTitle = typeof q.book === 'object' && q.book !== null 
        ? q.book.title 
        : q.book as string;
      grouped[theme].books.add(bookTitle);
      grouped[theme].quoteCount += 1;
    });

    return Object.entries(grouped)
      .map(([theme, data]) => ({
        theme,
        books: Array.from(data.books),
        quoteCount: data.quoteCount,
      }))
      .sort((a, b) => a.theme.localeCompare(b.theme));
  }, [myQuotes]);

  return {
    // Données
    myQuotes,
    allQuotes,
    allAuthors,
    allBooks,
    
    // Méthodes
    refreshMyQuotes,
    toggleLike,
    removeQuote,
    
    // Getters
    getBookCount,
    getAuthors,
    getBooksData,
    getAuthorsData,
    getThemes,
  };
};
