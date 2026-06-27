import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { useQuoteCreationFlow } from '@/src/entities/quote/lib';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { useBookActions } from '@/src/entities/book/lib/useBookActions';
import { useBookData } from '@/src/entities/book/lib/useBookData';
import { useBookLayout } from '@/src/entities/book/lib/useBookLayout';
import type { BlockData } from '@/src/shared/api/BlockService';
import { similarBooks as staticSimilarBooksMap } from '@/src/shared/api/staticData';
import type { Book } from '@/src/shared/api/types';
import { getAuthorName, getBookTitle, getStatusColor, getStatusLabel, isUserQuote } from '@/src/shared/lib/dataHelpers';
import { BlockContext } from '@/src/shared/ui/blocks/BlockDispatcher';
import type { Definition } from '@/src/shared/ui/blocks/DefinitionBlock';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

type TabType = 'description' | 'my_sheet';

const DESCRIPTION_BLOCKS = ['bookDescription', 'editions', 'author', 'savedQuotes', 'reviews', 'similarBooks', 'buy'];
const MYSHEET_BLOCKS = ['notes', 'dictionary', 'connection'];

const isBlockInTab = (blockKey: string, tab: TabType) => {
  if (blockKey === 'addBlock') return false;
  const base = blockKey.split('#')[0];
  if (tab === 'description') return DESCRIPTION_BLOCKS.includes(base);
  if (tab === 'my_sheet') return MYSHEET_BLOCKS.includes(base);
  return false;
};

export const useBookDetailController = () => {
  // ========== DONNÉES ==========
  const bookData = useBookData();
  const {
    bookInfo,
    authorInfo,
    isLoadingMetadata,
    bookId,
    bookTitleParam,
    inventaireUriParam,
    setIsImporting,
    setBookInfo,
  } = bookData;

  const { quotes } = useQuote();
  const { books: allBooks } = useAuthor();
  const queryClient = useQueryClient();

  // ========== ACTIONS ==========
  const {
    currentUser,
    navigateToBook,
    navigateToAuthor,
    router,
    computeIsSaved,
    computeCanToggleSave,
    computeUserQuotesCount,
    handleOpenStatusMenuWithId,
    handleHeaderSavePress: headerSavePress,
    handleShare,
  } = useBookActions();

  // ========== LAYOUT ==========
  const layoutProps = {
    bookTitle: bookInfo?.title || bookTitleParam,
    queryClient,
    bookId,
    bookTitleParam,
    inventaireUriParam,
  };
  const layout = useBookLayout(layoutProps);
  const {
    gridData,
    blockData,
    isLoadingLayout,
    lastSavedBookBlockData,
    reloadRef,
    handleUpdateBlockData,
    handleOrderChange,
    handleAddBlock,
    handleRemoveBlock,
    openAddBlockModal,
    closeAddBlockModal,
    setAddBlockModalVisible,
    isAddBlockModalVisible,
  } = layout;

  // ========== ÉTAT LOCAL ==========
  const [currentConnectionBlockId, setCurrentConnectionBlockId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('description');
  const [prevBookKey, setPrevBookKey] = useState<string | null>(null);
  const [isDictionaryModalVisible, setDictionaryModalVisible] = useState(false);
  const [isResourceSearchModalVisible, setResourceSearchModalVisible] = useState(false);

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  // ========== DÉPENDANCES LIVRE ==========
  const bookTitle = bookInfo?.title || bookTitleParam || (bookId ? allBooks.find(b => b.id === bookId)?.title : undefined);
  const currentBookKey = `${bookId}_${bookTitleParam}_${inventaireUriParam}`;

  // Reset state when book key changes (during render)
  if (currentBookKey !== prevBookKey) {
    setPrevBookKey(currentBookKey);
    setActiveTab('description');
  }

  // Invalidate queries when book key changes
  useEffect(() => {
    if (currentBookKey) {
      queryClient.invalidateQueries({ queryKey: ['book-detail'] });
    }
  }, [currentBookKey, queryClient]);

  // ========== QUOTES UTILISATEUR ==========
  const userQuotesCountForThisBook = useMemo(() => {
    return computeUserQuotesCount(quotes, bookTitle, currentUser?.id);
  }, [quotes, bookTitle, currentUser?.id, computeUserQuotesCount]);

  const isSaved = computeIsSaved(bookInfo, userQuotesCountForThisBook);
  const canToggleSave = computeCanToggleSave(userQuotesCountForThisBook);

  // ========== QUOTES SAUVÉES ==========
  const savedQuotes = useMemo(() => {
    return quotes.filter(q => {
      return isUserQuote(q, currentUser?.id) && getBookTitle(q.book).toLowerCase() === bookTitle?.toLowerCase();
    });
  }, [quotes, bookTitle, currentUser?.id]);

  // ========== LIVRES SIMILAIRES ==========
  const resolvedSimilarBooks = useMemo(() => {
    const serverSimilar = (bookInfo?.similarBooks || []) as (Book | Partial<Book>)[];
    const quoteMatchedTitles = savedQuotes.map(q => staticSimilarBooksMap[q.text]).filter((item): item is string[] => !!item).flat();
    const allTitlesOrBooks: (Book | Partial<Book>)[] = [...serverSimilar];

    quoteMatchedTitles.forEach(title => {
      const alreadyHas = allTitlesOrBooks.some(b => b.title?.toLowerCase() === title.toLowerCase());
      if (!alreadyHas) {
        const matchedBook = allBooks.find(b => b.title.toLowerCase() === title.toLowerCase());
        if (matchedBook) {
          allTitlesOrBooks.push(matchedBook);
        } else {
          allTitlesOrBooks.push({ title, cover: null, description: '', year: 0, pages: 0, rating: 0, genre: '', author: '' } as unknown as Partial<Book>);
        }
      }
    });

    if (allTitlesOrBooks.length === 0 && bookInfo) {
      const authorName = getAuthorName(bookInfo.author);
      const sameAuthor = allBooks.filter(b => b.id !== bookInfo.id && getAuthorName(b.author).toLowerCase() === authorName.toLowerCase());
      const sameGenre = allBooks.filter(b => b.id !== bookInfo.id && b.genre && b.genre !== 'Unknown' && b.genre !== '' && b.genre.toLowerCase() === bookInfo.genre?.toLowerCase());
      const fallbacks = [...sameAuthor, ...sameGenre];
      const uniqueFallbacks = fallbacks.filter((item, index, self) => self.findIndex(b => b.id === item.id) === index);
      allTitlesOrBooks.push(...uniqueFallbacks.slice(0, 5));
    }

    return allTitlesOrBooks;
  }, [bookInfo, savedQuotes, allBooks]);

  const enrichedBookInfo = useMemo(() => 
    bookInfo ? { ...bookInfo, similarBooks: resolvedSimilarBooks } : null,
    [bookInfo, resolvedSimilarBooks]
  );

  // Flux de création de quote (déclaré ici pour être utilisé dans blockContext)
  const { openAddQuoteFlow, renderQuoteModals } = useQuoteCreationFlow({
    initialBook: bookTitle,
    initialAuthor: bookInfo?.author ? getAuthorName(bookInfo.author) : '',
  });

  // ========== BLOCK CONTEXT ==========
  const blockContext = useMemo((): BlockContext => {
    const aggregatedDefinitions: { term: string, genre: string, definition: string, example: string }[] = [];
    const seenTerms = new Set<string>();

    savedQuotes.forEach(q => {
      if (q.blockData) {
        Object.keys(q.blockData).forEach(key => {
          if (key.startsWith('definition')) {
            const manualDefs = q.blockData![key] as unknown;
            if (Array.isArray(manualDefs)) {
              (manualDefs as { term: string; genre: string; definition: string; example: string }[]).forEach(d => {
                if (d && d.term && !seenTerms.has(d.term.toLowerCase())) {
                  seenTerms.add(d.term.toLowerCase());
                  aggregatedDefinitions.push(d);
                }
              });
            }
          }
        });
      }
      const quoteDefinitions = (q as { definitions?: Definition[] }).definitions;
      if (quoteDefinitions) {
        quoteDefinitions.forEach((d: Definition) => {
          if (d && d.term && !seenTerms.has(d.term.toLowerCase())) {
            seenTerms.add(d.term.toLowerCase());
            aggregatedDefinitions.push(d);
          }
        });
      }
    });

    const dictData = blockData?.['dictionary'] as { manualDefinitions?: Definition[]; hiddenTerms?: string[] } || { manualDefinitions: [], hiddenTerms: [] };
    const manualDefs = dictData.manualDefinitions || [];
    const hiddenTerms = new Set(dictData.hiddenTerms || []);
    const hiddenTermsSet = new Set(hiddenTerms);

    manualDefs.forEach((d: Definition) => {
      if (!seenTerms.has(d.term.toLowerCase())) {
        seenTerms.add(d.term.toLowerCase());
        aggregatedDefinitions.push(d);
      }
    });

    const visibleDefinitions = aggregatedDefinitions
      .filter(d => !hiddenTermsSet.has(d.term.toLowerCase()))
      .sort((a, b) => a.term.localeCompare(b.term));

    return {
      book: enrichedBookInfo,
      author: authorInfo,
      savedQuotes,
      blockData,
      onUpdateBlockData: handleUpdateBlockData,
      onReviewAdded: () => reloadRef.current(),
      onManageDictionary: () => setDictionaryModalVisible(true),
      onBookPress: (idOrTitle, uri) => navigateToBook(idOrTitle, uri),
      onAuthorPress: (name, uri) => navigateToAuthor(name, uri),
      onQuotePress: (quote) => router.navigate(`/quote-detail?quote=${encodeURIComponent(JSON.stringify(quote))}`),
      onConnectionSearchPress: (blockId) => {
        setCurrentConnectionBlockId(blockId);
        setResourceSearchModalVisible(true);
      },
      onAddQuote: openAddQuoteFlow,
      visibleDefinitions,
      hiddenTerms: Array.from(hiddenTermsSet),
      manualDefinitions: manualDefs,
      aggregatedDefinitions
    } as BlockContext & {
      visibleDefinitions: Definition[];
      hiddenTerms: string[];
      manualDefinitions: Definition[];
      aggregatedDefinitions: Definition[];
    };
  }, [enrichedBookInfo, authorInfo, savedQuotes, blockData, handleUpdateBlockData, router, navigateToBook, navigateToAuthor, openAddQuoteFlow, reloadRef]);

  // ========== GESTION DES ONGS ==========
  const { aggregatedDefinitions, hiddenTerms, manualDefinitions } = blockContext as BlockContext & {
    visibleDefinitions: Definition[];
    hiddenTerms: string[];
    manualDefinitions: Definition[];
    aggregatedDefinitions: Definition[];
  };

  // Handlers pour les modales
  const handleResourceSelected = useCallback((resource: unknown) => {
    if (currentConnectionBlockId) {
      handleUpdateBlockData(currentConnectionBlockId, resource as BlockData);
      setResourceSearchModalVisible(false);
      setCurrentConnectionBlockId(null);
    }
  }, [currentConnectionBlockId, handleUpdateBlockData]);

  // ========== HANDLERS WRAPPED ==========
  const wrappedHandleOpenStatusMenuWithId = useCallback((id: number) => {
    handleOpenStatusMenuWithId(id, bookInfo, setBookInfo, userQuotesCountForThisBook);
  }, [handleOpenStatusMenuWithId, bookInfo, setBookInfo, userQuotesCountForThisBook]);

  const wrappedHandleHeaderSavePress = useCallback(() => {
    return headerSavePress(bookInfo, setBookInfo, setIsImporting, bookTitle);
  }, [headerSavePress, bookInfo, setBookInfo, setIsImporting, bookTitle]);

  const wrappedHandleShare = useCallback(() => {
    return handleShare(bookInfo, bookTitle);
  }, [handleShare, bookInfo, bookTitle]);

  // ========== TAB FILTERING ==========
  const currentTabBlocks = useMemo(() => (gridData || []).filter(key => isBlockInTab(key, activeTab)), [gridData, activeTab]);
  const filteredBlockOptions = useMemo(() => (
    activeTab === 'description'
      ? ['bookDescription', 'editions', 'author', 'savedQuotes', 'reviews', 'similarBooks', 'buy']
      : ['notes', 'dictionary', 'connection']
  ).map(key => ({ key, label: key })), [activeTab]);

  // ========== RETURN ==========
  return {
    router,
    navigateToBook,
    navigateToAuthor,
    bookId,
    bookTitleParam,
    currentUser,
    bookTitle,
    bookInfo,
    authorInfo,
    isLoadingMetadata,
    gridData,
    blockData,
    isLoadingLayout,
    isAddBlockModalVisible,
    isDictionaryModalVisible,
    isResourceSearchModalVisible,
    currentConnectionBlockId,
    activeTab,
    setActiveTab,
    lastSavedBookBlockData,
    reloadRef,
    currentTabBlocks,
    filteredBlockOptions,
    scrollableRef,
    userQuotesCountForThisBook,
    isSaved,
    canToggleSave,
    handleOpenStatusMenuWithId: wrappedHandleOpenStatusMenuWithId,
    handleHeaderSavePress: wrappedHandleHeaderSavePress,
    handleShare: wrappedHandleShare,
    savedQuotes,
    resolvedSimilarBooks,
    enrichedBookInfo,
    handleUpdateBlockData,
    handleResourceSelected,
    blockContext,
    aggregatedDefinitions,
    hiddenTerms,
    manualDefinitions,
    handleOrderChange,
    openAddBlockModal,
    closeAddBlockModal,
    handleAddBlock,
    handleRemoveBlock,
    setAddBlockModalVisible,
    setDictionaryModalVisible,
    setResourceSearchModalVisible,
    setCurrentConnectionBlockId,
    renderQuoteModals,
    getStatusLabel,
    getStatusColor,
    getBookTitle,
    getAuthorName,
    DESCRIPTION_BLOCKS,
    MYSHEET_BLOCKS,
    colors: useMemo(() => ({} as Record<string, string>), []),
    styles: undefined,
  };
};
