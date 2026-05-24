import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { X, Plus, ChevronLeft, User, Calendar, BookOpen, Star, Quote, Sparkles, Send, MessageSquare, ShoppingCart, ExternalLink, Bookmark, Share as ShareIcon, Check } from 'lucide-react-native';
import { useData } from '@/src/app/providers/DataProvider';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useAuth } from '@/src/app/providers/AuthContext';
import { ThemeColors } from '@/src/shared/theme';
import { Book, Author } from '@/src/shared/api/types';
import { Modal, Alert, Linking, Share, ActionSheetIOS, Platform } from 'react-native';
import type { SortableGridRenderItem } from 'react-native-sortables';
import Sortable from 'react-native-sortables';
import Animated, { useAnimatedRef, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import AddBlockModal from '@/src/features/edit-book/ui/AddBlockModal';
import BookDictionaryModal from '@/src/features/dictionary/ui/BookDictionaryModal';
import ResourceSearchModal from '@/src/features/search/ui/ResourceSearchModal';
import { TextInput } from 'react-native';
import { getBookTitle, getAuthorName, getStatusColor, getStatusLabel, STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { BlockDispatcher, BlockContext } from '@/src/shared/ui/blocks/BlockDispatcher';
import { BOOK_DETAIL_BLOCK_OPTIONS, BLOCK_CONFIGS } from '@/src/shared/config/blocks';
import { similarBooks as staticSimilarBooksMap } from '@/src/shared/api/staticData';
import { authService } from '@/src/entities/user/api/AuthService';
import { API_BASE_URL } from '@/src/shared/config/api';

const DESCRIPTION_BLOCKS = ['bookDescription', 'editions', 'author', 'savedQuotes', 'reviews', 'buy', 'similarBooks'];
const MYSHEET_BLOCKS = ['notes', 'dictionary', 'connection'];
type TabType = 'description' | 'my_sheet';

const isBlockInTab = (blockKey: string, tab: TabType) => {
  // blockKey e.g. "author#123" or "addBlock"
  if (blockKey === 'addBlock') return false;
  const base = blockKey.split('#')[0];
  if (tab === 'description') return DESCRIPTION_BLOCKS.includes(base);
  if (tab === 'my_sheet') return MYSHEET_BLOCKS.includes(base);
  return false;
};

const blockOptions = BOOK_DETAIL_BLOCK_OPTIONS.map(key => ({
  key,
  label: BLOCK_CONFIGS[key].label
}));

export const DetailSkeleton = ({ colors }: { colors: ThemeColors }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
       <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
          <Animated.View style={[{ width: 120, height: 180, borderRadius: 8, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
          <Animated.View style={[{ width: '70%', height: 24, borderRadius: 4, backgroundColor: colors.surfaceHighlight, marginBottom: 8 }, animatedStyle]} />
          <Animated.View style={[{ width: '40%', height: 16, borderRadius: 4, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
       </View>
       
       <Animated.View style={[{ width: '100%', height: 100, borderRadius: 12, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
       <Animated.View style={[{ width: '100%', height: 150, borderRadius: 12, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
       <Animated.View style={[{ width: '100%', height: 80, borderRadius: 12, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
    </ScrollView>
  );
};

const isBookEnriched = (book: Book | null | undefined): boolean => {
  if (!book) return false;
  return !!(book.description && book.description.length >= 50);
};

export default function BookDetailScreen() {
  const { user: currentUser } = useAuth();
  const { navigateToBook, navigateToAuthor } = useSmartNavigation();
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ bookId?: string; bookTitle?: string; bookData?: string; cover?: string }>();
  const bookId = rawParams.bookId ? Number(rawParams.bookId) : undefined;
  const bookTitleParam = rawParams.bookTitle as string | undefined;
  const bookCoverParam = rawParams.cover as string | undefined;

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { quotes, books: allBooks, getBlockLayout, updateBlockLayout, getBookData, updateBookData, getBookByTitle, getAuthorByName, getBookById, toggleSaveBook, updateBookStatus } = useData();

  const allBooksRef = React.useRef(allBooks);
  React.useEffect(() => {
    allBooksRef.current = allBooks;
  }, [allBooks]);

  // Check if book is already in local cached list to initialize state immediately
  const initialLocalBook = useMemo(() => {
    if (!bookId && !bookTitleParam) return null;
    if (bookId) {
      return allBooks.find(b => b.id === bookId) || null;
    }
    if (bookTitleParam) {
      return allBooks.find(b => b.title.toLowerCase() === bookTitleParam.toLowerCase()) || null;
    }
    return null;
  }, [bookId, bookTitleParam, allBooks]);

  const [bookInfo, setBookInfo] = useState<Book | null>(initialLocalBook);
  const [authorInfo, setAuthorInfo] = useState<Author | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(!initialLocalBook || !isBookEnriched(initialLocalBook));
  const bookTitle = bookInfo?.title || bookTitleParam;

  // Reset state when bookId changes
  React.useEffect(() => {
    setBookInfo(initialLocalBook);
    setAuthorInfo(null);
    setGridData([]);
    setBlockData({});
    lastSavedBookBlockData.current = '{}';
    setIsLoadingLayout(true);
    setIsLoadingMetadata(!initialLocalBook || !isBookEnriched(initialLocalBook));
    setActiveTab('description');
  }, [bookId, bookTitleParam]);
  const [gridData, setGridData] = useState<string[]>([]);
  const [blockData, setBlockData] = useState<Record<string, any>>({});
  const lastSavedBookBlockData = React.useRef<string>('{}');
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);
  const [isAddBlockModalVisible, setAddBlockModalVisible] = useState(false);
  const [isDictionaryModalVisible, setDictionaryModalVisible] = useState(false);
  const [isResourceSearchModalVisible, setResourceSearchModalVisible] = useState(false);
  const [currentConnectionBlockId, setCurrentConnectionBlockId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('description');





  const currentTabBlocks = useMemo(() => (gridData || []).filter(key => isBlockInTab(key, activeTab)), [gridData, activeTab]);

  const filteredBlockOptions = useMemo(() => activeTab === 'description'
    ? blockOptions.filter(opt => DESCRIPTION_BLOCKS.includes(opt.key))
    : blockOptions.filter(opt => MYSHEET_BLOCKS.includes(opt.key)), [activeTab, blockOptions]);

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  const loadMetadata = useCallback(async (signal?: AbortSignal) => {
    if (!bookId && !bookTitleParam) return;

    console.log('[BookDetail] loadMetadata triggered', { bookId, bookTitleParam });

    // 1. Try to find the book in our local cached list first!
    let localBook: Book | undefined;
    if (bookId) {
      localBook = allBooksRef.current.find(b => b.id === bookId);
    } else if (bookTitleParam) {
      localBook = allBooksRef.current.find(b => b.title.toLowerCase() === bookTitleParam.toLowerCase());
    }

    // 2. If we found a local book, set it immediately and bypass the loading screen if it's already enriched!
    if (localBook) {
      console.log('[BookDetail] Found book in local cache');
      setBookInfo(localBook);
      if (isBookEnriched(localBook)) {
        setIsLoadingMetadata(false);
      }
      
      // Also load author locally if possible to be fast
      const authorName = getAuthorName(localBook.author);
      const fetchedAuthor = await getAuthorByName(authorName);
      if (fetchedAuthor) setAuthorInfo(fetchedAuthor);
    } else {
      // If it's a new book not in library, we show the loading spinner initially
      setIsLoadingMetadata(true);
    }

    try {
      let currentBook: Book | undefined;

      if (bookId) {
        // Canonical path: fetch by ID
        currentBook = await getBookById(bookId);
      } else if (bookTitleParam) {
        // Fallback: fetch by title (legacy + citations)
        currentBook = await getBookByTitle(bookTitleParam);
      }

      if (!currentBook && rawParams.bookData) {
        console.log('[BookDetail] Book not found locally, importing from search data...');
        try {
          const bookDataParam = JSON.parse(rawParams.bookData);
          const token = await authService.getToken();
          const BASE_URL = API_BASE_URL;
          
          console.log('[BookDetail] Sending POST to:', `${BASE_URL}/books/import`);
          
          const response = await fetch(`${BASE_URL}/books/import`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({
                  title: bookDataParam.label || bookDataParam.title,
                  description: bookDataParam.description || '',
                  cover: bookDataParam.image || bookDataParam.cover || '',
                  inventaireUri: bookDataParam.uri || bookDataParam.inventaireUri,
                  googleId: bookDataParam.googleId,
                  isbn: bookDataParam.isbn,
                  year: bookDataParam.year,
                  pages: bookDataParam.pages,
                  genre: bookDataParam.genre,
                  authors: bookDataParam.authors || [],
                  authorUris: bookDataParam.authorUris || [],
              }),
              signal
          });
          
          console.log('[BookDetail] Import response status:', response.status);
          if (response.ok) {
              const imported = await response.json();
              if (imported) {
                  const importedBook = imported as Book;
                  currentBook = importedBook;
                  setBookInfo(importedBook);
                  const authorName = getAuthorName(importedBook.author);
                  const fetchedAuthor = await getAuthorByName(authorName);
                  if (fetchedAuthor) setAuthorInfo(fetchedAuthor);
              }
          } else {
              const errorText = await response.text();
              console.error('[BookDetail] Import request failed with status:', response.status, 'body:', errorText);
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log('[BookDetail] Import request aborted');
            return;
          }
          console.error('[BookDetail] Failed to import book from search:', error);
        }
      }

      if (currentBook) {
        setBookInfo(currentBook);
        
        // If the book is sparse (no description or no genre), force a synchronous enrichment
        if (!currentBook.description || currentBook.description.length < 50 || !currentBook.genre || currentBook.genre === 'Unknown' || currentBook.genre === '') {
          console.log('[BookDetail] Book is sparse or lacks genre, forcing synchronous enrichment...');
          try {
            const token = await authService.getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const BASE_URL = API_BASE_URL;
            const enrichRes = await fetch(`${BASE_URL}/books/${currentBook.id}/enrich`, { method: 'POST', headers, signal });
            if (enrichRes.ok) {
              const enrichedBook = await enrichRes.json();
              setBookInfo(enrichedBook);
              currentBook = enrichedBook;
            }
          } catch (e: any) {
            if (e.name === 'AbortError') {
              console.log('[BookDetail] Enrichment request aborted');
              return;
            }
            console.error('[BookDetail] Synch enrichment failed:', e);
          }
        }

        if (currentBook) {
          const authorName = getAuthorName(currentBook.author);
          const fetchedAuthor = await getAuthorByName(authorName);
          if (fetchedAuthor) setAuthorInfo(fetchedAuthor);

          // Ensure cover matches the ISBN popup
          if (bookCoverParam && currentBook.cover !== bookCoverParam) {
            currentBook = { ...currentBook, cover: bookCoverParam };
            setBookInfo(currentBook);
          }
        }
      } else {
        console.log('[BookDetail] Book not found');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[BookDetail] loadMetadata request aborted');
        return;
      }
      console.error('Error loading book/author metadata:', err);
    } finally {
      // Always ensure loading stops at the very end
      setIsLoadingMetadata(false);
    }
  }, [bookId, bookTitleParam, getBookById, getBookByTitle, getAuthorByName, bookCoverParam, rawParams.bookData]);

  React.useEffect(() => {
    const controller = new AbortController();
    loadMetadata(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadMetadata]);

  // Fetch saved layout
  React.useEffect(() => {
    if (bookTitle) {
      Promise.all([
        getBlockLayout(bookTitle, 'book'),
        getBookData(bookTitle)
      ]).then(([layout, data]) => {
        // Filter out legacy 'addBlock' from layout if present
        const filteredLayout = (layout || []).filter(x => x !== 'addBlock');
        setGridData(filteredLayout);
        const resolvedData = data || {};
        lastSavedBookBlockData.current = JSON.stringify(resolvedData);
        setBlockData(resolvedData);
        setIsLoadingLayout(false);
      });
    }
  }, [bookTitle, getBlockLayout, getBookData]);

  // Autosave blockData effect

  React.useEffect(() => {
    if (!bookTitle || !blockData) return;

    const dataStr = JSON.stringify(blockData);
    if (dataStr === lastSavedBookBlockData.current) return;

    const timer = setTimeout(() => {
      updateBookData(bookTitle, blockData);
      lastSavedBookBlockData.current = dataStr;
    }, 1000);
    return () => clearTimeout(timer);
  }, [blockData, bookTitle, updateBookData]);


  const userQuotesCountForThisBook = useMemo(() => quotes.filter(q => {
    const isMyQuote = q.user?.id === currentUser?.id || !q.user;
    return isMyQuote && getBookTitle(q.book) === bookTitle;
  }).length, [quotes, bookTitle, currentUser]);

  const isSaved = bookInfo?.isSaved || userQuotesCountForThisBook > 0;
  const canToggleSave = userQuotesCountForThisBook === 0;

  const handleOpenStatusMenu = () => {
    if (!bookInfo?.id) return;

    const options = [...STATUS_OPTIONS];
    const canUnsave = userQuotesCountForThisBook === 0;

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
              // Remove from library
              await toggleSaveBook(bookInfo.id!);
              setBookInfo(prev => prev ? { ...prev, isSaved: false, readingStatus: null } : null);
            } else {
              const selected = options[buttonIndex - 1];
              await updateBookStatus(bookInfo.id!, selected.value);
              setBookInfo(prev => prev ? { ...prev, readingStatus: selected.value as any, isSaved: true } : null);
            }
          }
        }
      );
    } else {
      const androidButtons: any[] = [
        { text: 'Annuler', style: 'cancel' },
        ...STATUS_OPTIONS.map(o => ({
          text: o.label,
          onPress: async () => {
            await updateBookStatus(bookInfo.id!, o.value);
            setBookInfo(prev => prev ? { ...prev, readingStatus: o.value as any, isSaved: true } : null);
          }
        }))
      ];

      if (isSaved && canUnsave) {
        androidButtons.push({
          text: 'Retirer de ma bibliothèque',
          style: 'destructive',
          onPress: async () => {
            await toggleSaveBook(bookInfo.id!);
            setBookInfo(prev => prev ? { ...prev, isSaved: false, readingStatus: null } : null);
          }
        });
      }

      Alert.alert('Classer ce livre', 'Choisissez une catégorie', androidButtons);
    }
  };

  const handleShare = async () => {
    if (!bookInfo) return;
    try {
      const authorName = getAuthorName(bookInfo.author);
      await Share.share({
        message: `Découvrez "${bookTitle}" de ${authorName} sur Quotex !`,
      });
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const savedQuotes = quotes.filter(q => getBookTitle(q.book) === bookTitle);

  // Résoudre la liste consolidée de livres similaires (serveur + citations statiques + fallback auteur/genre)
  const resolvedSimilarBooks = useMemo(() => {
    const serverSimilar = bookInfo?.similarBooks || [];
    
    // 1. Récupérer les recommandations curées basées sur les citations
    const quoteMatchedTitles = savedQuotes
      .map(q => staticSimilarBooksMap[q.text])
      .filter((item): item is string[] => !!item)
      .flat();

    const allTitlesOrBooks = [...serverSimilar];

    // 2. Ajouter les recommandations par citation si non présentes
    quoteMatchedTitles.forEach(title => {
      const alreadyHas = allTitlesOrBooks.some(b => 
        b.title.toLowerCase() === title.toLowerCase()
      );
      if (!alreadyHas) {
        const matchedBook = allBooks.find(b => b.title.toLowerCase() === title.toLowerCase());
        if (matchedBook) {
          allTitlesOrBooks.push(matchedBook);
        } else {
          // Objet livre partiel
          allTitlesOrBooks.push({ title, cover: null, description: '', year: 0, pages: 0, rating: 0, genre: '', author: '' } as any);
        }
      }
    });

    // 3. Fallback sur les livres du même auteur ou même genre si vide
    if (allTitlesOrBooks.length === 0 && bookInfo) {
      const authorName = getAuthorName(bookInfo.author);
      const sameAuthor = allBooks.filter(b => 
        b.id !== bookInfo.id && 
        getAuthorName(b.author).toLowerCase() === authorName.toLowerCase()
      );
      const sameGenre = allBooks.filter(b => 
        b.id !== bookInfo.id && 
        b.genre && b.genre !== 'Unknown' && b.genre !== '' &&
        b.genre.toLowerCase() === bookInfo.genre?.toLowerCase()
      );
      
      const fallbacks = [...sameAuthor, ...sameGenre];
      const uniqueFallbacks = fallbacks.filter((item, index, self) =>
        self.findIndex(b => b.id === item.id) === index
      );
      
      allTitlesOrBooks.push(...uniqueFallbacks.slice(0, 5));
    }

    return allTitlesOrBooks;
  }, [bookInfo, savedQuotes, allBooks]);

  const enrichedBookInfo = useMemo(() => {
    if (!bookInfo) return null;
    return {
      ...bookInfo,
      similarBooks: resolvedSimilarBooks
    };
  }, [bookInfo, resolvedSimilarBooks]);


  const handleUpdateBlockData = useCallback((blockId: string, data: any) => {
    setBlockData(current => ({ ...current, [blockId]: data }));
  }, []);

  const handleResourceSelected = (resource: any) => {
    if (currentConnectionBlockId) {
      handleUpdateBlockData(currentConnectionBlockId, resource);
      setResourceSearchModalVisible(false);
      setCurrentConnectionBlockId(null);
    }
  };

  const blockContext = useMemo((): BlockContext => {
    // Dictionary aggregation logic for context
    const aggregatedDefinitions: Array<{ term: string, genre: string, definition: string, example: string }> = [];
    const seenTerms = new Set<string>();

    savedQuotes.forEach(q => {
      if (q.blockData) {
        Object.keys(q.blockData).forEach(key => {
          if (key.startsWith('definition')) {
            const manualDefs = q.blockData![key] as Array<{ term: string, genre: string, definition: string, example: string }>;
            if (Array.isArray(manualDefs)) {
              manualDefs.forEach(d => {
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

    // We need to cast hiddenTerms to set of strings if it's not already
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
      onReviewAdded: loadMetadata,
      onManageDictionary: () => setDictionaryModalVisible(true),
      onBookPress: (idOrTitle, uri) => navigateToBook(idOrTitle, uri),
      onAuthorPress: (name, uri) => navigateToAuthor(name, uri),
      onQuotePress: (quote) => router.navigate(`/quote-detail?quote=${encodeURIComponent(JSON.stringify(quote))}`),
      onConnectionSearchPress: (blockId) => {
        setCurrentConnectionBlockId(blockId);
        setResourceSearchModalVisible(true);
      },
      // Extra properties for dictionary block
      ...({ visibleDefinitions, hiddenTerms: Array.from(hiddenTermsSet), manualDefinitions: manualDefs, aggregatedDefinitions } as any)
    };
  }, [enrichedBookInfo, authorInfo, savedQuotes, blockData, handleUpdateBlockData, loadMetadata, router]);

  // Extract dictionary props for the Modal which sits outside Dispatcher
  const { aggregatedDefinitions, hiddenTerms, manualDefinitions } = (blockContext as any);




  const handleOrderChange = (fromIndex: number, toIndex: number) => {
    setGridData(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      // Persist
      if (bookTitle) updateBlockLayout(bookTitle, 'book', arr);
      return arr;
    });
  };


  const openAddBlockModal = () => setAddBlockModalVisible(true);
  const closeAddBlockModal = () => setAddBlockModalVisible(false);

  const handleAddBlock = (blockKey: string) => {
    const newLayout = [...gridData.filter(x => x !== 'addBlock'), `${blockKey}#${Date.now()}`];
    setGridData(newLayout);
    if (bookTitle) updateBlockLayout(bookTitle, 'book', newLayout);
    closeAddBlockModal();
  };

  const handleRemoveBlock = (itemToRemove: string) => {
    if (itemToRemove === 'addBlock') return;

    const newLayout = gridData.filter(x => x !== itemToRemove);

    setGridData(newLayout);
    if (bookTitle) updateBlockLayout(bookTitle, 'book', newLayout);
  };



  const renderGridItem = useCallback<SortableGridRenderItem<string>>(({ item, index }) => {
    return (
      <BlockDispatcher
        blockId={item}
        context={blockContext}
        onRemove={() => handleRemoveBlock(item)}
      />
    );
  }, [blockContext, handleRemoveBlock]);

  if (!bookTitle) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Aucun livre spécifié.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoadingMetadata) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
            <View style={styles.saveButton} />
          </View>
          <DetailSkeleton colors={colors} />
        </View>
      </SafeAreaView>
    );
  }

  if (!bookInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{bookTitle}</Text>
            <View style={styles.saveButton} />
          </View>
          <Text style={styles.errorText}>Livre non trouvé sur le serveur.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Use server rating or fallback
  const averageRating = bookInfo.rating ? bookInfo.rating.toFixed(1) : 'N/A';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
              <ShareIcon size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton]}
              onPress={handleOpenStatusMenu}
            >
              {isSaved ? (
                <Check size={24} color={colors.primary} />
              ) : (
                <Plus size={24} color={colors.text} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Animated.ScrollView
          ref={scrollableRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Book Information */}
          <View style={styles.section}>
            <View style={styles.bookContainer}>
              <Image source={{ uri: bookInfo.cover }} style={styles.bookCoverImage} />
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitleText}>{bookTitle}</Text>
                <TouchableOpacity 
                  disabled={!bookInfo.author || getAuthorName(bookInfo.author) === 'Auteur inconnu'}
                  onPress={() => {
                    const authorName = getAuthorName(bookInfo.author);
                    const inventaireUri = typeof bookInfo.author === 'object' && bookInfo.author !== null ? (bookInfo.author as Author).inventaireUri : undefined;
                    navigateToAuthor(authorName, inventaireUri);
                  }}
                >
                  <Text style={styles.bookAuthorText}>{getAuthorName(bookInfo.author)}</Text>
                </TouchableOpacity>

                {/* Book Meta Info */}
                <View style={styles.bookMeta}>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{bookInfo.year}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <BookOpen size={14} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{bookInfo.pages} p.</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Star size={14} color={colors.primary} fill={colors.primary} />
                    <Text style={styles.metaText}>{averageRating}/5</Text>
                  </View>
                </View>

                {/* Genre Badge */}
                <View style={styles.badgeContainer}>
                  {bookInfo.genre && bookInfo.genre !== 'Unknown' && bookInfo.genre !== '' && (
                    <View style={styles.genreBadge}>
                      <Text style={styles.genreText}>{bookInfo.genre}</Text>
                    </View>
                  )}

                  {/* Category Badge */}
                  {bookInfo.readingStatus && (
                    <View style={[styles.statusBadge, { 
                      backgroundColor: getStatusColor(bookInfo.readingStatus) + '15', 
                      borderColor: getStatusColor(bookInfo.readingStatus) + '40' 
                    }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(bookInfo.readingStatus) }]}>
                        {getStatusLabel(bookInfo.readingStatus)}
                      </Text>
                    </View>
                  )}

                  {/* Prize Badges */}
                  {bookInfo.laureates?.map(laureate => (
                    <TouchableOpacity 
                      key={`prize-${laureate.id}`} 
                      onPress={() => {
                        if (laureate.prizeId) {
                          router.push({
                            pathname: '/prize-detail',
                            params: { prizeId: laureate.prizeId.toString() }
                          });
                        }
                      }}
                      style={[styles.statusBadge, { 
                        backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                        borderColor: 'rgba(239, 68, 68, 0.4)' 
                      }]}
                    >
                      <Text style={[styles.statusText, { color: '#EF4444' }]}>
                        {laureate.prize?.name} {laureate.year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* TABS */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'description' && styles.activeTabButton]}
              onPress={() => setActiveTab('description')}
            >
              <Text style={[styles.tabText, activeTab === 'description' && styles.activeTabText]}>Description</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'my_sheet' && styles.activeTabButton]}
              onPress={() => setActiveTab('my_sheet')}
            >
              <Text style={[styles.tabText, activeTab === 'my_sheet' && styles.activeTabText]}>Ma fiche</Text>
            </TouchableOpacity>
          </View>


          <View style={styles.gridSection}>
            <View style={styles.sectionHeader}>
              {/* Optional: Change title based on Tab? Or keep generic */}
              <Text style={styles.sectionTitle}>
                {activeTab === 'description' ? 'Détails du livre' : 'Mon espace personnel'}
              </Text>
            </View>
            {activeTab === 'description' ? (
              <View style={{ gap: 10 }}>
                {DESCRIPTION_BLOCKS.map(blockKey => (
                  <BlockDispatcher
                    key={blockKey}
                    blockId={blockKey}
                    context={blockContext}
                  />
                ))}
              </View>
            ) : (
              <>
                <Sortable.Grid
                  columns={1}
                  data={currentTabBlocks}
                  renderItem={renderGridItem}
                  rowGap={10}
                  columnGap={10}
                  scrollableRef={scrollableRef}
                  autoScrollEnabled={true}
                  autoScrollActivationOffset={75}
                  onOrderChange={(params) => {
                    const { fromIndex, toIndex } = params as { fromIndex: number; toIndex: number };
                    // logic needs to map back to original gridData indices if we want to support reorder
                    // But Sortable.Grid works on the data passed to it. 
                    // Since we are passing a filtered subset, the indices returned are for that subset.
                    // We need to map them back to the real separate list indices or handle it carefully.

                    // Complexity warning: Reordering a filtered list and syncing back to the main list is tricky.
                    // Simplified approach: Create a helper to reorder within the main list based on the subset movement.

                    const itemMoving = currentTabBlocks[fromIndex];
                    // Remove itemMoving from gridData
                    const compacted = gridData.filter(x => x !== itemMoving);

                    // Find where to insert. 
                    // We need to find the "neighbor" in the full list to know where to drop it.
                    // if toIndex is 0, we put it before the first item of the current view (if any)
                    // if toIndex is N, we put it after the Nth item of the current view.

                    let insertIndexInMaster = -1;

                    if (toIndex === 0) {
                      // Put before the first item of the CURRENT VIEW that exists in the master list
                      if (currentTabBlocks.length > 1) { // >1 because we haven't mutated currentTabBlocks yet effectively in this logic context
                        // The item at toIndex (which is currently someone else)
                        const neighbor = currentTabBlocks[0] === itemMoving ? currentTabBlocks[1] : currentTabBlocks[0];
                        // Wait, if fromIndex was 0 and toIndex is 0, no change.
                        // Sortable calls this when change happens.
                      }
                    }

                    // This is getting complicated. 
                    // Alternative: Just update the `gridData` by rebuilding it. 
                    // We have `currentTabBlocks` which reflects the NEW order (Sortable handled the visual drag).
                    // Wait, Sortable.Grid onOrderChange gives us the new indices. It doesn't give us the new array automatically in the callback params usually, or it does?
                    // The library expects us to update the data source.

                    // Let's manually construct the new sub-array
                    const newSubOrder = [...currentTabBlocks];
                    const [moved] = newSubOrder.splice(fromIndex, 1);
                    newSubOrder.splice(toIndex, 0, moved);

                    // Now verify this against the master `gridData`.
                    // We want to preserve the relative order of items NOT in this tab.
                    // And enforce the new order for items IN this tab.

                    const newMasterList: string[] = [];
                    let subIndex = 0;
                    for (const item of gridData) {
                      if (isBlockInTab(item, activeTab)) {
                        // This slot belongs to the current tab stream
                        if (subIndex < newSubOrder.length) {
                          newMasterList.push(newSubOrder[subIndex]);
                          subIndex++;
                        }
                      } else {
                        // Keep other tab items in place
                        newMasterList.push(item);
                      }
                    }

                    // Safety check: verify we didn't lose anything (e.g. if addBlock is in both?)
                    // Actually addBlock is in both. This logic might duplicate it or mess it up.
                    // Special case: 'addBlock' is usually at the end. 
                    // Let's rely on simple filtering. 

                    setGridData(newMasterList);
                    if (bookTitle) updateBlockLayout(bookTitle, 'book', newMasterList);
                  }}
                />
                <TouchableOpacity style={styles.placeholderSection} onPress={openAddBlockModal}>
                  <Plus size={20} color="#9CA3AF" style={styles.placeholderIcon} />
                  <Text style={styles.placeholderText}>Ajouter un bloc</Text>
                </TouchableOpacity>
                <AddBlockModal
                  visible={isAddBlockModalVisible}
                  onClose={closeAddBlockModal}
                  onSelect={handleAddBlock}
                  options={filteredBlockOptions}
                />
              </>
            )}
          </View>
        </Animated.ScrollView>

        {/* Full Screen Reviews Modal */}

        <BookDictionaryModal
          visible={isDictionaryModalVisible}
          onClose={() => setDictionaryModalVisible(false)}
          availableDefinitions={aggregatedDefinitions || []}
          hiddenTerms={(hiddenTerms || []) as string[]}
          currentManualDefinitions={manualDefinitions || []}
          onUpdate={(newManuals, newHidden) => {
            handleUpdateBlockData('dictionary', { manualDefinitions: newManuals, hiddenTerms: newHidden });
          }}
        />

        <ResourceSearchModal
          visible={isResourceSearchModalVisible}
          onClose={() => {
            setResourceSearchModalVisible(false);
            setCurrentConnectionBlockId(null);
          }}
          onSelect={handleResourceSelected}
        />

      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center', marginLeft: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerButton: { padding: 4 },
  saveButton: { padding: 4, width: 32, alignItems: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bookContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  bookCoverImage: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  bookAuthorText: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 12,
  },
  bookMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  genreBadge: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)', // Keeping manual opacity for now as theme doesn't have it
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  genreText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bookDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginBottom: 8,
  },
  authorDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  savedQuotesList: {
    gap: 12,
  },
  savedQuoteCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    padding: 12,
  },
  savedQuoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text, // Was #E5E7EB
    fontStyle: 'italic',
    marginBottom: 8,
  },
  savedQuoteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  savedQuoteAuthor: {
    fontSize: 12,
    color: colors.primary,
  },
  savedQuoteDate: {
    fontSize: 12,
    color: colors.textTertiary, // Was #6B7280
  },
  similarBooksContainer: {
    marginHorizontal: -8,
  },
  similarBookItem: {
    width: 90,
    marginHorizontal: 8,
  },
  similarBookCover: {
    width: 90,
    height: 135,
    borderRadius: 8,
    marginBottom: 8,
  },
  similarBookTitle: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 16,
  },
  placeholderSection: {
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  placeholderIcon: {
    marginBottom: 8,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  removableWrapper: {
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: colors.text, textAlign: 'center', marginTop: 50 },
  notesInput: {
    backgroundColor: colors.inputBackground, // Was #0B0B0B, theme input prop has dark values
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.inputText,
    fontSize: 13,
    minHeight: 120,
  },
  userRatingContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  subTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
  },
  commentInputContainer: {
    marginBottom: 20,
  },
  commentInput: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.inputText,
    fontSize: 13,
    minHeight: 80,
  },
  reviewsList: {
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  reviewItem: {
    backgroundColor: colors.background, // Was #0F0F0F
    borderRadius: 12,
    padding: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  reviewerName: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  reviewDate: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 6,
  },
  reviewComment: {
    fontSize: 13,
    color: colors.textSecondary, // Was #D1D5DB
    lineHeight: 18,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    gap: 6,
  },
  publishButtonText: {
    color: '#000', // Text on primary color. Theme doesn't specify 'onPrimary'. #000 is safe for #20B8CD.
    fontSize: 12,
    fontWeight: '600',
  },
  seeAllReviewsButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  seeAllReviewsText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
    gap: 16,
  },
  modalReviewItem: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
  },
  reviewerAvatarLarge: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewerNameLarge: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  reviewCommentLarge: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginTop: 8,
  },
  buyLinksList: {
    gap: 12,
  },
  buyLinkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000', // Buy link might be specific black? Keep for now or use background.
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buyLinkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buyLinkStore: {
    color: '#FFF', // Always white on black button? 
    fontSize: 14,
    fontWeight: '500',
  },
  buyLinkPrice: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighlight,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.text,
    fontWeight: '600',
  },
});