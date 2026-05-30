import { useCallback, useMemo } from 'react';
import { useData } from '@/src/app/providers/DataProvider';
import { useAuth } from '@/src/app/providers/AuthContext';
import { Quote, Book, Author } from '@/src/shared/api/types';

/**
 * Hook feature pour la gestion des citations de l'utilisateur
 * Découple la page MyQuotesScreen du DataProvider
 */
export const useMyQuotes = () => {
  const { 
    quotes: allQuotes, 
    authors: allAuthors, 
    books: allBooks,
    toggleLikeQuote, 
    deleteQuote, 
    refreshQuotes, 
    refreshAuthors, 
    refreshBooks 
  } = useData();
  
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
    await deleteQuote(quoteId);
  }, [deleteQuote]);

  // Obtenir le nombre de livres uniques
  const getBookCount = useCallback(() => {
    return new Set(myQuotes.map(q => {
      if (typeof q.book === 'object' && q.book) {
        return q.book.title;
      }
      return q.book as string;
    })).size;
  }, [myQuotes]);

  // Obtenir la liste des auteurs uniques
  const getAuthors = useCallback(() => {
    const authors = new Set<string>();
    myQuotes.forEach(q => {
      if (typeof q.author === 'object' && q.author) {
        authors.add(q.author.name);
      } else {
        authors.add(q.author as string);
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
      const title = typeof quote.book === 'object' && quote.book 
        ? quote.book.title 
        : (quote.book as string);
      const author = typeof quote.author === 'object' && quote.author 
        ? quote.author.name 
        : (quote.author as string);
      
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
        const authorName = typeof book.author === 'object' && book.author 
          ? book.author.name 
          : book.author;
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
      const name = typeof quote.author === 'object' && quote.author 
        ? quote.author.name 
        : (quote.author as string);
      
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
      name: typeof data.author === 'object' && data.author 
        ? data.author.name 
        : data.author,
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
      
      const bookTitle = typeof q.book === 'object' && q.book 
        ? q.book.title 
        : (q.book as string);
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
