import { useAuth } from '@/src/app/providers/AuthContext';
import { ReadingStatus } from '@/src/entities/author/model/Author';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { buildBookImportPayload } from '@/src/entities/book/lib/bookImport';
import { loadBookDetailData } from '@/src/entities/book/lib/loadBookDetailData';
import { useQuoteCreationFlow } from '@/src/entities/quote/lib';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { BlockService } from '@/src/shared/api/BlockService';
import { similarBooks as staticSimilarBooksMap } from '@/src/shared/api/staticData';
import { Author, Book } from '@/src/shared/api/types';
import { getAuthorName, getBookTitle, getStatusColor, getStatusLabel, isUserQuote, STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { BlockContext } from '@/src/shared/ui/blocks/BlockDispatcher';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Share } from 'react-native';
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
  const { user: currentUser } = useAuth();
  const { navigateToBook, navigateToAuthor } = useSmartNavigation();
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ bookId?: string; bookTitle?: string; inventaireUri?: string; bookData?: string; cover?: string }>();
  const bookId = rawParams.bookId ? Number(rawParams.bookId) : undefined;
  const bookTitleParam = rawParams.bookTitle as string | undefined;
  const inventaireUriParam = rawParams.inventaireUri as string | undefined;
  const bookCoverParam = rawParams.cover as string | undefined;

  // Remplacement de useData() par les hooks spécifiques
  const { quotes } = useQuote();
  const { 
    books: allBooks, 
    toggleSaveBook, 
    updateBookStatus, 
    importBook,
    getBookById,
    getBookByTitle,
    getBookByInventaireUri,
    getAuthorByName,
  } = useAuthor();
  
  // Méthodes pour BlockService
  const getBlockLayout = useCallback((parentId: string | number, parentType: 'quote' | 'book') => {
    return BlockService.getLayout(parentId, parentType);
  }, []);
  
  const updateBlockLayout = useCallback((parentId: string | number, parentType: 'quote' | 'book', layout: string[]) => {
    return BlockService.saveLayout(parentId, parentType, layout);
  }, []);
  
  // Méthodes pour BookData
  const getBookData = useCallback((bookTitle: string) => {
    return BlockService.getBlockData(bookTitle, 'book');
  }, []);
  
  const updateBookData = useCallback((bookTitle: string, data: Record<string, any>) => {
    return BlockService.saveBlockData(bookTitle, 'book', data);
  }, []);

  const [bookInfo, setBookInfo] = useState<Book | null>(null);
  const [authorInfo, setAuthorInfo] = useState<Author | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [gridData, setGridData] = useState<string[]>([]);
  const [blockData, setBlockData] = useState<Record<string, any>>({});
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);
  const [isAddBlockModalVisible, setAddBlockModalVisible] = useState(false);
  const [isDictionaryModalVisible, setDictionaryModalVisible] = useState(false);
  const [isResourceSearchModalVisible, setResourceSearchModalVisible] = useState(false);
  const [currentConnectionBlockId, setCurrentConnectionBlockId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('description');

  const lastSavedBookBlockData = React.useRef<string>('{}');
  const reloadRef = React.useRef<() => void>(() => {});

  const bookTitle = bookInfo?.title || bookTitleParam || (bookId ? allBooks.find(b => b.id === bookId)?.title : undefined);

  const { openAddQuoteFlow, renderQuoteModals } = useQuoteCreationFlow({
    initialBook: bookTitle,
    initialAuthor: bookInfo?.author ? getAuthorName(bookInfo.author) : '',
  });

  const [prevBookKey, setPrevBookKey] = useState<string>('');
  const currentBookKey = `${bookId}_${bookTitleParam}_${inventaireUriParam}`;
  if (currentBookKey !== prevBookKey) {
    setPrevBookKey(currentBookKey);
    setBookInfo(null);
    setAuthorInfo(null);
    setGridData([]);
    setBlockData({});
    // eslint-disable-next-line react-hooks/refs
    lastSavedBookBlockData.current = '{}';
    setIsLoadingLayout(true);
    setIsLoadingMetadata(true);
    setActiveTab('description');
  }

  useEffect(() => {
    let mounted = true;

    if (!bookId && !bookTitleParam) {
      if (mounted) {
        Promise.resolve().then(() => {
          setIsLoadingMetadata(false);
        });
      }
      return;
    }

    const load = async () => {
      try {
        const result = await loadBookDetailData({
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
        });

        if (mounted) {
          setBookInfo(result.book);
          setAuthorInfo(result.author);
        }
      } catch (err) {
        console.error('[BookDetail] load error:', err);
      } finally {
        if (mounted) setIsLoadingMetadata(false);
      }
    };

    reloadRef.current = () => { if (mounted) void load(); };
    void load();

    return () => { mounted = false; };
  }, [bookId, bookTitleParam, inventaireUriParam, bookCoverParam, rawParams.bookData, getBookById, getBookByTitle, getBookByInventaireUri, importBook, getAuthorByName]);

  const currentTabBlocks = useMemo(() => (gridData || []).filter(key => isBlockInTab(key, activeTab)), [gridData, activeTab]);
  const filteredBlockOptions = useMemo(() => (
    activeTab === 'description'
      ? ['bookDescription', 'editions', 'author', 'savedQuotes', 'reviews', 'similarBooks', 'buy']
      : ['notes', 'dictionary', 'connection']
  ).map(key => ({ key, label: key })), [activeTab]);
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    if (!bookTitle) return;
    Promise.all([
      getBlockLayout(bookTitle, 'book'),
      getBookData(bookTitle),
    ]).then(([layout, data]) => {
      const filteredLayout = (layout || []).filter(x => x !== 'addBlock');
      setGridData(filteredLayout);
      const resolvedData = data || {};
      lastSavedBookBlockData.current = JSON.stringify(resolvedData);
      setBlockData(resolvedData);
      setIsLoadingLayout(false);
    });
  }, [bookTitle, getBlockLayout, getBookData]);

  useEffect(() => {
    if (!bookTitle || !blockData) return;

    const dataStr = JSON.stringify(blockData);
    if (dataStr === lastSavedBookBlockData.current) return;

    const timer = setTimeout(() => {
      updateBookData(bookTitle, blockData);
      lastSavedBookBlockData.current = dataStr;
    }, 1000);
    return () => clearTimeout(timer);
  }, [blockData, bookTitle, updateBookData]);

  const userQuotesCountForThisBook = useMemo(() => {
    return quotes.filter(q => {
      return isUserQuote(q, currentUser?.id) && getBookTitle(q.book).toLowerCase() === bookTitle?.toLowerCase();
    }).length;
  }, [quotes, bookTitle, currentUser]);

  const isSaved = bookInfo?.isSaved || userQuotesCountForThisBook > 0;

  const handleOpenStatusMenuWithId = useCallback((id: number) => {
    const options = [...STATUS_OPTIONS];
    const canUnsave = userQuotesCountForThisBook === 0;

    const changeStatusOptimistic = async (status: string) => {
      const prevBookInfo = bookInfo;
      setBookInfo(prev => prev ? { ...prev, readingStatus: status as any, isSaved: true } : null);
      try {
        await updateBookStatus(id, status as ReadingStatus);
      } catch {
        setBookInfo(prevBookInfo);
        Alert.alert('Erreur', 'Impossible de mettre à jour le statut du livre.');
      }
    };

    const unsaveBookOptimistic = async () => {
      const prevBookInfo = bookInfo;
      setBookInfo(prev => prev ? { ...prev, isSaved: false, readingStatus: null } : null);
      try {
        await toggleSaveBook(id);
      } catch {
        setBookInfo(prevBookInfo);
        Alert.alert('Erreur', 'Impossible de retirer le livre de la bibliothèque.');
      }
    };

    if (Platform.OS === 'ios') {
      const iosOptions = ['Annuler', ...options.map(o => o.label)];
      if (isSaved && canUnsave) {
        iosOptions.push('Retirer de ma bibliothèque');
      }

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: iosOptions,
          cancelButtonIndex: 0,
          destructiveButtonIndex: (isSaved && canUnsave) ? iosOptions.length - 1 : undefined,
          title: 'Classer ce livre',
        },
        async (buttonIndex) => {
          if (buttonIndex > 0) {
            if (isSaved && canUnsave && buttonIndex === iosOptions.length - 1) {
              await unsaveBookOptimistic();
            } else {
              const selected = options[buttonIndex - 1];
              await changeStatusOptimistic(selected.value);
            }
          }
        }
      );
      return;
    }

    const androidButtons: any[] = [
      { text: 'Annuler', style: 'cancel' },
      ...STATUS_OPTIONS.map(o => ({
        text: o.label,
        onPress: () => changeStatusOptimistic(o.value)
      }))
    ];

    if (isSaved && canUnsave) {
      androidButtons.push({
        text: 'Retirer de ma bibliothèque',
        style: 'destructive',
        onPress: unsaveBookOptimistic
      });
    }

    Alert.alert('Classer ce livre', 'Choisissez une catégorie', androidButtons);
  }, [bookInfo, isSaved, toggleSaveBook, updateBookStatus, userQuotesCountForThisBook]);

  const handleHeaderSavePress = useCallback(async () => {
    let currentBookInfo = bookInfo;
    if (!currentBookInfo) return;

    if (!currentBookInfo.id) {
      try {
        setIsLoadingMetadata(true);
        const importPayload = buildBookImportPayload({
          title: currentBookInfo.title,
          cover: currentBookInfo.cover,
          book: currentBookInfo,
        });

        if (!importPayload) {
          Alert.alert('Erreur', 'Impossible de préparer l import du livre.');
          return;
        }

        const imported = await importBook(importPayload);
        if (imported?.id) {
          currentBookInfo = imported;
          setBookInfo(imported);
        } else {
          Alert.alert('Erreur', 'Impossible de créer le livre sur le serveur.');
          return;
        }
      } catch (err) {
        console.error('[BookDetail] Failed to import book before saving:', err);
        Alert.alert('Erreur', 'Une erreur est survenue lors de la création du livre.');
        return;
      } finally {
        setIsLoadingMetadata(false);
      }
    }

    if (currentBookInfo?.id) {
      handleOpenStatusMenuWithId(currentBookInfo.id);
    }
  }, [bookInfo, importBook, handleOpenStatusMenuWithId]);

  const handleShare = useCallback(async () => {
    if (!bookInfo) return;
    try {
      const authorName = getAuthorName(bookInfo.author);
      await Share.share({ message: `Découvrez "${bookTitle}" de ${authorName} sur Quotex !` });
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  }, [bookInfo, bookTitle]);

  const savedQuotes = useMemo(() => {
    return quotes.filter(q => {
      return isUserQuote(q, currentUser?.id) && getBookTitle(q.book).toLowerCase() === bookTitle?.toLowerCase();
    });
  }, [quotes, bookTitle, currentUser]);

  const resolvedSimilarBooks = useMemo(() => {
    const serverSimilar = bookInfo?.similarBooks || [];
    const quoteMatchedTitles = savedQuotes.map(q => staticSimilarBooksMap[q.text]).filter((item): item is string[] => !!item).flat();
    const allTitlesOrBooks = [...serverSimilar];

    quoteMatchedTitles.forEach(title => {
      const alreadyHas = allTitlesOrBooks.some(b => b.title.toLowerCase() === title.toLowerCase());
      if (!alreadyHas) {
        const matchedBook = allBooks.find(b => b.title.toLowerCase() === title.toLowerCase());
        if (matchedBook) {
          allTitlesOrBooks.push(matchedBook);
        } else {
          allTitlesOrBooks.push({ title, cover: null, description: '', year: 0, pages: 0, rating: 0, genre: '', author: '' } as any);
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

  const enrichedBookInfo = useMemo(() => bookInfo ? { ...bookInfo, similarBooks: resolvedSimilarBooks } : null, [bookInfo, resolvedSimilarBooks]);

  const handleUpdateBlockData = useCallback((blockId: string, data: any) => {
    setBlockData(current => ({ ...current, [blockId]: data }));
  }, []);

  const handleResourceSelected = useCallback((resource: any) => {
    if (currentConnectionBlockId) {
      handleUpdateBlockData(currentConnectionBlockId, resource);
      setResourceSearchModalVisible(false);
      setCurrentConnectionBlockId(null);
    }
  }, [currentConnectionBlockId, handleUpdateBlockData]);

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
      if ((q as any).definitions) {
        (q as any).definitions.forEach((d: any) => {
          if (d && d.term && !seenTerms.has(d.term.toLowerCase())) {
            seenTerms.add(d.term.toLowerCase());
            aggregatedDefinitions.push(d);
          }
        });
      }
    });

    const dictData = blockData?.['dictionary'] || { manualDefinitions: [], hiddenTerms: [] };
    const manualDefs = dictData.manualDefinitions || [];
    const hiddenTerms = new Set(dictData.hiddenTerms || []);
    const hiddenTermsSet = new Set(hiddenTerms);

    manualDefs.forEach((d: any) => {
      if (!seenTerms.has(d.term.toLowerCase())) {
        seenTerms.add(d.term.toLowerCase());
        aggregatedDefinitions.push(d as any);
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
      ...({ visibleDefinitions, hiddenTerms: Array.from(hiddenTermsSet), manualDefinitions: manualDefs, aggregatedDefinitions } as any)
    };
  }, [enrichedBookInfo, authorInfo, savedQuotes, blockData, handleUpdateBlockData, router, navigateToBook, navigateToAuthor, openAddQuoteFlow]);

  const { aggregatedDefinitions, hiddenTerms, manualDefinitions } = (blockContext as any);

  const handleOrderChange = useCallback((fromIndex: number, toIndex: number) => {
    setGridData(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      if (bookTitle) updateBlockLayout(bookTitle, 'book', arr);
      return arr;
    });
  }, [bookTitle, updateBlockLayout]);

  const openAddBlockModal = useCallback(() => setAddBlockModalVisible(true), []);
  const closeAddBlockModal = useCallback(() => setAddBlockModalVisible(false), []);

  const handleAddBlock = useCallback((blockKey: string) => {
    const newLayout = [...gridData.filter(x => x !== 'addBlock'), `${blockKey}#${Date.now()}`];
    setGridData(newLayout);
    if (bookTitle) updateBlockLayout(bookTitle, 'book', newLayout);
    closeAddBlockModal();
  }, [bookTitle, closeAddBlockModal, gridData, updateBlockLayout]);

  const handleRemoveBlock = useCallback((itemToRemove: string) => {
    if (itemToRemove === 'addBlock') return;
    const newLayout = gridData.filter(x => x !== itemToRemove);
    setGridData(newLayout);
    if (bookTitle) updateBlockLayout(bookTitle, 'book', newLayout);
  }, [bookTitle, gridData, updateBlockLayout]);

  return {
    router,
    navigateToBook,
    navigateToAuthor,
    bookId,
    bookTitleParam,
    getBookById,
    getBookByTitle,
    colors: useMemo(() => ({}) as any, []),
    styles: undefined,
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
    canToggleSave: userQuotesCountForThisBook === 0,
    handleOpenStatusMenuWithId,
    handleHeaderSavePress,
    handleShare,
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
  };
};
