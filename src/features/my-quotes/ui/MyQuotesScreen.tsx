import { AppText, CounterTab, IconButton, TabBar } from '@/src/shared/ui';
import { InteractiveTooltip } from '@/src/shared/ui/modals/InteractiveTooltip';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from 'expo-router/react-navigation';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useRouter } from '@/src/shared/navigation/useRouter';
import { Book as BookIcon, Bookmark, Filter, Hash, Plus, Quote as QuoteIcon, Search, Users, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';


import { useTabIndex } from '@/src/app/providers/TabContext';
import ScanPreviewModal from '@/src/shared/ui/modals/ScanPreviewModal';
import SimpleScanModal, { SimpleScanResult } from '@/src/shared/ui/modals/SimpleScanModal';
import ScanWorkflow from '@/src/features/scanner/ui/ScanWorkflow';
import { bookDescriptions } from '@/src/shared/api/staticData';

import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useQuoteActions } from '@/src/entities/quote/lib';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { Quote } from '@/src/shared/api/types';
import { getAuthorName, getBookTitle, getStatusLabel, STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { ThemeColors, tokens as defaultTokens } from '@/src/shared/theme';

// Entity components - OK to import from entities per FSD
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { ReadingStatus } from '@/src/entities/author/model/Author';
import AuthorCardItem, { AuthorCardData } from '@/src/entities/author/ui/AuthorCardItem';
import BookCardItem, { BookCardData } from '@/src/entities/book/ui/BookCardItem';
import ThemeCardItem, { ThemeCardData } from '@/src/entities/theme/ui/ThemeCardItem';
import BookActionModal from '@/src/entities/book/ui/BookActionModal';
import AddQuoteMenu from '@/src/entities/quote/ui/AddQuoteMenu';
import FilterModal, { FilterType } from '@/src/entities/quote/ui/FilterModal';
import QuoteActionModal from '@/src/entities/quote/ui/QuoteActionModal';
import QuoteCard from '@/src/entities/quote/ui/QuoteCard';

// Feature hook
import { useMyQuotes } from '../model/useMyQuotes';

interface AnimatedHeaderTitleProps {
  viewMode: 'quotes' | 'books' | 'themes' | 'authors';
  colors: ThemeColors;
  styles: any;
}

const TAB_INDEXES = {
  quotes: 0,
  books: 1,
  authors: 2,
  themes: 3,
};

const AnimatedHeaderTitle = ({ viewMode, colors, styles }: AnimatedHeaderTitleProps) => {
  const [currentMode, setCurrentMode] = useState(viewMode);
  const [prevMode, setPrevMode] = useState<'quotes' | 'books' | 'themes' | 'authors' | null>(null);

  const enterProgress = useSharedValue(1);
  const exitProgress = useSharedValue(0);
  const direction = useSharedValue(1); // 1 = forward (slide left), -1 = backward (slide right)

  /* eslint-disable react-hooks/immutability */

  // Adjust state synchronously during render when viewMode changes
  if (viewMode !== currentMode) {
    setPrevMode(currentMode);
    setCurrentMode(viewMode);
  }

  // Adjust shared values synchronously when currentMode / prevMode changes
  useLayoutEffect(() => {
    if (prevMode !== null) {
      const currentIdx = TAB_INDEXES[currentMode];
      const prevIdx = TAB_INDEXES[prevMode];
      direction.value = currentIdx >= prevIdx ? 1 : -1;

      enterProgress.value = 0;
      exitProgress.value = 0;
    }
  }, [currentMode, prevMode, direction, enterProgress, exitProgress]);

  // Trigger animations in response to currentMode / prevMode changes
  useEffect(() => {
    if (prevMode !== null) {
      enterProgress.value = withTiming(1, { duration: 300 });
      exitProgress.value = withTiming(1, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(setPrevMode)(null);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMode, prevMode]);

  /* eslint-enable react-hooks/immutability */

  const enterStyle = useAnimatedStyle(() => {
    return {
      opacity: enterProgress.value,
      transform: [
        { translateX: 150 * direction.value * (1 - enterProgress.value) }
      ],
    };
  });

  const exitStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - exitProgress.value,
      transform: [
        { translateX: -150 * direction.value * exitProgress.value }
      ],
    };
  });

  const renderContent = (mode: 'quotes' | 'books' | 'themes' | 'authors') => {
    return (
      <>
        {mode === 'quotes' && <QuoteIcon size={24} color={colors.text} />}
        {mode === 'books' && <BookIcon size={24} color={colors.text} />}
        {mode === 'authors' && <Users size={24} color={colors.text} />}
        {mode === 'themes' && <Hash size={24} color={colors.text} />}
        <AppText style={styles.headerTitle}>
          {mode === 'quotes' && 'Mes Citations'}
          {mode === 'books' && 'Mes Livres'}
          {mode === 'authors' && 'Mes Auteurs'}
          {mode === 'themes' && 'Mes Thèmes'}
        </AppText>
      </>
    );
  };

  return (
    <View style={styles.headerLeftContainer}>
      {prevMode && (
        <Animated.View style={[styles.headerLeft, exitStyle, styles.absoluteHeaderLeft]}>
          {renderContent(prevMode)}
        </Animated.View>
      )}
      <Animated.View style={[styles.headerLeft, enterStyle]}>
        {renderContent(currentMode)}
      </Animated.View>
    </View>
  );
};

// ListHeader component memoized pour éviter les re-renders inutiles
interface ListHeaderMemoProps {
  activeFilters: { type: 'author' | 'book' | 'year' | 'status'; value: string | number }[];
  viewMode: 'quotes' | 'books' | 'authors' | 'themes';
  selectedStatus: string;
  colors: ThemeColors;
  styles: any;
  removeFilter: (filter: { type: 'author' | 'book' | 'year' | 'status'; value: string | number }) => void;
  resetFilters: () => void;
  setSelectedStatus: (status: string) => void;
  quoteSubFilter?: 'ALL' | 'PUBLISHED' | 'SAVED';
  setQuoteSubFilter?: (filter: 'ALL' | 'PUBLISHED' | 'SAVED') => void;
}

const ListHeaderMemo = React.memo(function ListHeaderMemo({
  activeFilters,
  viewMode,
  selectedStatus,
  colors,
  styles,
  removeFilter,
  resetFilters,
  setSelectedStatus,
  quoteSubFilter,
  setQuoteSubFilter,
}: ListHeaderMemoProps) {
  const elements: React.ReactNode[] = [];

  if (activeFilters.length > 0) {
    elements.push(
      <View key="filters" style={styles.filterContainer}>
        {activeFilters.map((filter, index) => (
          <TouchableOpacity key={`${filter.type}-${filter.value}-${index}`} style={styles.filterBadge} onPress={() => removeFilter(filter)}>
            <AppText style={styles.filterBadgeText}>
              {filter.type === 'author' ? 'Auteur' :
                filter.type === 'book' ? 'Livre' :
                  filter.type === 'year' ? 'Année' : 'Statut'}: {
                filter.type === 'status' ? getStatusLabel(filter.value as string) : filter.value
              }
            </AppText>
            <X size={12} color={colors.primary} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={resetFilters} style={styles.clearFilterButton}>
          <AppText style={styles.clearFilterButtonText}>Tout effacer</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  if (viewMode === 'books') {
    elements.push(
      <View key="status-pills" style={{ marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusFilterContainer}
          contentContainerStyle={styles.statusFilterContent}
        >
          <TouchableOpacity
            onPress={() => setSelectedStatus('ALL')}
            style={[
              styles.statusFilterBadge,
              selectedStatus === 'ALL' && styles.statusFilterBadgeActive
            ]}
          >
            <AppText style={[
              styles.statusFilterText,
              selectedStatus === 'ALL' && styles.statusFilterTextActive
            ]}>Tout</AppText>
          </TouchableOpacity>
          {STATUS_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSelectedStatus(opt.value)}
              style={[
                styles.statusFilterBadge,
                selectedStatus === opt.value && { backgroundColor: opt.color + '15', borderColor: opt.color }
              ]}
            >
              <AppText style={[
                styles.statusFilterText,
                selectedStatus === opt.value && { color: opt.color }
              ]}>{opt.label}</AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (viewMode === 'quotes') {
    elements.push(
      <TabBar
        key="quote-sub-pills"
        tabs={[
          { id: 'ALL', label: 'Tout' },
          { id: 'PUBLISHED', label: 'Publiées' },
          { id: 'SAVED', label: 'Enregistrées' },
        ]}
        activeTab={quoteSubFilter || 'ALL'}
        onTabPress={(tabId) => setQuoteSubFilter?.(tabId as any)}
        style={{ paddingHorizontal: 0, paddingBottom: 0, marginBottom: 16, backgroundColor: 'transparent' }}
      />
    );
  }

  return elements.length > 0 ? <>{elements}</> : null;
});

interface EmptyStateViewProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
  styles: any;
}

const EmptyStateView = React.memo(function EmptyStateView({
  icon,
  title,
  description,
  buttonLabel,
  onButtonPress,
  styles,
}: EmptyStateViewProps) {
  return (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyStateIconContainer}>{icon}</View>
      <AppText style={styles.emptyStateTitle}>{title}</AppText>
      <AppText style={styles.emptyStateDescription}>{description}</AppText>
      {buttonLabel && onButtonPress && (
        <TouchableOpacity style={styles.emptyStateButton} onPress={onButtonPress} activeOpacity={0.8}>
          <AppText style={styles.emptyStateButtonText}>{buttonLabel}</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
});

interface AddFooterCardProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  styles: any;
}

const AddFooterCard = React.memo(function AddFooterCard({
  label,
  icon,
  onPress,
  styles,
}: AddFooterCardProps) {
  return (
    <TouchableOpacity
      style={styles.addFooterCard}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.addFooterIconContainer}>{icon}</View>
      <AppText style={styles.addFooterLabel}>{label}</AppText>
    </TouchableOpacity>
  );
});

export default function MyQuotesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [showManualQuoteModal, setShowManualQuoteModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSimpleScanModal, setShowSimpleScanModal] = useState(false);
  const [scannedText, setScannedText] = useState('');
  const [activeScanResult, setActiveScanResult] = useState<SimpleScanResult | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [tempFilters, setTempFilters] = useState<FilterType[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [quoteSubFilter, setQuoteSubFilter] = useState<'ALL' | 'PUBLISHED' | 'SAVED'>('ALL');
  const [viewMode, setViewMode] = useState<'quotes' | 'books' | 'themes' | 'authors'>('quotes');
  const [firstItemHeight, setFirstItemHeight] = useState(150);
  const { user: currentUser } = useAuth();

  // Feature hook - découplé de DataProvider
  const {
    myQuotes,
    allBooks,
    refreshMyQuotes,
    toggleLike: toggleLikeQuote,
    removeQuote: deleteQuote,
    getBookCount,
    getAuthors,
    getBooksData,
    getAuthorsData,
    getThemes
  } = useMyQuotes();

  const { handleConfirmSave } = useQuoteActions();
  const { toggleSaveQuote, syncStatus } = useQuote();
  const { tabIndex, setTabIndex } = useTabIndex();

  // Ref pour scroller vers le haut après un ajout via le scanner
  const quotesListRef = useRef<FlashListRef<Quote> | null>(null);

  const scrollToQuotesTop = useCallback(() => {
    setViewMode('quotes');
    setTimeout(() => {
      quotesListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 50);
  }, []);

  const isFocused = tabIndex === 0;

  // Scroll vers le haut quand on revient à l'onglet "Mes Citations" (tabIndex = 0)
  useEffect(() => {
    if (tabIndex === 0 && quotesListRef.current) {
      quotesListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [tabIndex]);

  // Edit State
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [actionMenuQuote, setActionMenuQuote] = useState<Quote | null>(null);
  
  const { updateBookStatus, toggleSaveBook } = useAuthor();
  const [actionMenuBook, setActionMenuBook] = useState<BookCardData | null>(null);

  const handleOpenBookMenu = useCallback((book: BookCardData) => {
    setActionMenuBook(book);
  }, []);

  const handleOpenBookStatusMenu = useCallback((book: BookCardData) => {
    const bookId = book.id;
    if (!bookId) return;
    const options = [...STATUS_OPTIONS];

    const changeStatus = async (status: string) => {
      try {
        await updateBookStatus(bookId, status as ReadingStatus);
      } catch {
        Alert.alert('Erreur', 'Impossible de mettre à jour le statut du livre.');
      }
    };

    if (Platform.OS === 'ios') {
      const iosOptions = ['Annuler', ...options.map(o => o.label)];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: iosOptions,
          cancelButtonIndex: 0,
          title: 'Classer ce livre',
        },
        async (buttonIndex) => {
          if (buttonIndex > 0) {
            const selected = options[buttonIndex - 1];
            await changeStatus(selected.value);
          }
        }
      );
      return;
    }

    const androidButtons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[] = [
      { text: 'Annuler', style: 'cancel' },
      ...STATUS_OPTIONS.map(o => ({
        text: o.label,
        onPress: () => changeStatus(o.value)
      }))
    ];

    Alert.alert('Classer ce livre', 'Choisissez une catégorie', androidButtons);
  }, [updateBookStatus]);

  const handleDeleteBook = useCallback(async (book: BookCardData) => {
    const performDelete = async () => {
      try {
        // 1. Delete all quotes associated with this book
        const quotesToDelete = myQuotes.filter(q => {
          const qBookTitle = getBookTitle(q.book);
          return qBookTitle.toLowerCase() === book.title.toLowerCase();
        });

        for (const q of quotesToDelete) {
          await deleteQuote(q.id);
        }

        // 2. Unsave the book if it has an ID
        if (book.id) {
          const latestBook = allBooks.find(b => b.id === book.id);
          if (latestBook?.isSaved) {
            await toggleSaveBook(book.id);
          }
        }
      } catch (err) {
        console.error("Failed to delete book and quotes", err);
        Alert.alert("Erreur", "Impossible de supprimer le livre.");
      }
    };

    if (book.quoteCount > 0) {
      Alert.alert(
        "Supprimer le livre",
        "Supprimer ce livre supprimera également toutes les citations associées. Êtes-vous sûr de vouloir continuer ?",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Supprimer", style: "destructive", onPress: performDelete }
        ]
      );
    } else {
      await performDelete();
    }
  }, [myQuotes, allBooks, deleteQuote, toggleSaveBook]);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Re-essayer les quotes en attente de sync, puis rafraîchir la liste
      if (syncStatus.pendingCount > 0) {
        syncStatus.syncNow();
      }
      await refreshMyQuotes();
    } catch (error) {
      console.error("Refresh failed", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshMyQuotes, syncStatus]);

  const isScreenFocused = useIsFocused();
  // useCopilot removed

  useEffect(() => {
    if (isScreenFocused && isFocused) {
      setTabIndex(0);
      refreshMyQuotes();
    }
  }, [isScreenFocused, isFocused, refreshMyQuotes, setTabIndex]);

  useEffect(() => {
    if (isScreenFocused) {
      const checkResume = async () => {
        const resumeStep = await AsyncStorage.getItem('resume_tour_step');
        if (resumeStep) {
          await AsyncStorage.removeItem('resume_tour_step');
          setTimeout(() => {
            // startTour(resumeStep).catch(err => console.log('Copilot resume error:', err));
          }, 600);
        }
      };
      checkResume();
    }
  }, [isScreenFocused]);



  // Derived data - appel direct des getters (useMemo inutiles supprimés)
  const authors = getAuthors();
  const books = getBooksData();
  const bookCount = getBookCount();

  const years = useMemo(() => {
    return [...new Set(
      myQuotes
        .map(q => bookDescriptions[getBookTitle(q.book)]?.year)
        .filter((year): year is number => !!year)
    )].sort((a, b) => b - a);
  }, [myQuotes]);

  // Liste des thèmes
  const themes = getThemes();

  // Derived filtered quotes
  const quotesToDisplay = useMemo(() => {
    let filtered = [...myQuotes];

    if (quoteSubFilter === 'PUBLISHED') {
      filtered = filtered.filter(q => q.user?.id === currentUser?.id || !q.user);
    } else if (quoteSubFilter === 'SAVED') {
      filtered = filtered.filter(q => q.user && q.user?.id !== currentUser?.id && q.isSaved);
    }

    if (activeFilters.length > 0) {
      const filtersByType = activeFilters.reduce((acc, filter) => {
        if (!acc[filter.type]) {
          acc[filter.type] = [];
        }
        acc[filter.type].push(filter.value);
        return acc;
      }, {} as Record<'author' | 'book' | 'year' | 'status', (string | number)[]>);

      filtered = filtered.filter(q => {
        const authorMatch = !filtersByType.author || filtersByType.author.includes(getAuthorName(q.author));
        const bookMatch = !filtersByType.book || filtersByType.book.includes(getBookTitle(q.book));
        const yearMatch = !filtersByType.year || (bookDescriptions[getBookTitle(q.book)] && filtersByType.year.includes(bookDescriptions[getBookTitle(q.book)].year));

        // Find matching book in allBooks to get the up-to-date readingStatus
        const bookTitle = getBookTitle(q.book);
        const latestBook = allBooks.find(b => b.title.toLowerCase() === bookTitle.toLowerCase());
        const currentReadingStatus = latestBook?.readingStatus || (q.book && typeof q.book === 'object' ? q.book.readingStatus : null);

        const statusMatch = !filtersByType.status || (currentReadingStatus && filtersByType.status.includes(currentReadingStatus));
        return authorMatch && bookMatch && yearMatch && statusMatch;
      });
    }
    return filtered;
  }, [myQuotes, activeFilters, allBooks, quoteSubFilter, currentUser]);

  // Authors data
  const authorsData = getAuthorsData();

  const filteredBooksByStatus = useMemo(() => {
    if (selectedStatus === 'ALL') return books;
    return books.filter(b => b.readingStatus === selectedStatus);
  }, [books, selectedStatus]);

  const hasActiveBookFilters = activeFilters.length > 0 || selectedStatus !== 'ALL';
  const hasActiveQuoteFilters = myQuotes.length > 0 && (activeFilters.length > 0 || quoteSubFilter !== 'ALL');
  const hasActiveAuthorFilters = activeFilters.length > 0;
  const hasActiveThemeFilters = activeFilters.length > 0;

  const [prevActiveFilters, setPrevActiveFilters] = useState<FilterType[]>([]);
  if (activeFilters !== prevActiveFilters) {
    setPrevActiveFilters(activeFilters);
    setTempFilters([...activeFilters]);
  }

  const toggleTempFilter = useCallback((type: 'author' | 'book' | 'year' | 'status', value: string | number) => {
    setTempFilters(currentFilters => {
      const existingFilterIndex = currentFilters.findIndex(f => f.type === type && f.value === value);
      if (existingFilterIndex > -1) {
        return currentFilters.filter((_, index) => index !== existingFilterIndex);
      } else {
        return [...currentFilters, { type, value }];
      }
    });
  }, []);

  const applyFilters = useCallback(() => {
    setActiveFilters([...tempFilters]);
    setFilterModalVisible(false);
  }, [tempFilters]);

  const removeFilter = useCallback((filterToRemove: FilterType) => {
    setActiveFilters(currentFilters =>
      currentFilters.filter(
        f => !(f.type === filterToRemove.type && f.value === filterToRemove.value)
      )
    );
  }, []);

  const resetFilters = useCallback(() => {
    setActiveFilters([]);
    setTempFilters([]);
    if (filterModalVisible) {
      setFilterModalVisible(false);
    }
  }, [filterModalVisible]);

  const handleOpenMenu = useCallback((quote: Quote) => {
    setActionMenuQuote(quote);
  }, []);



  // Wrapper stable pour toggleLikeQuote
  const toggleLikeQuoteStable = useCallback((id: number) => {
    return toggleLikeQuote(id);
  }, [toggleLikeQuote]);

  // Render items for FlashList
  const renderQuoteItem = useCallback(({ item, index }: { item: Quote; index: number }) => {
    const card = (
      <QuoteCard
        quote={item}
        onToggleLike={() => toggleLikeQuoteStable(item.id)}
        onOpenMenu={() => handleOpenMenu(item)}
        showSavedDate
      />
    );

    if (index === 0) {
      return (
        <InteractiveTooltip
          stepNames={['myQuotesList', 'quoteCardDetail']}
          texts={[
            "Les citations enregistrées se retrouvent ici.",
            "Quand on clique sur une citation, on accède aux détails de la citation."
          ]}
          placement="bottom"
          allowChildInteraction={true}
        >
          <View 
            style={{ width: '100%' }}
            onLayout={(event) => {
              const { height } = event.nativeEvent.layout;
              if (height > 0) {
                setFirstItemHeight(prev => (Math.abs(prev - height) > 2 ? height : prev));
              }
            }}
          >
            {card}
          </View>
        </InteractiveTooltip>
      );
    }

    return card;
  }, [toggleLikeQuoteStable, handleOpenMenu]);

  const renderBookItem = useCallback(({ item, index }: { item: BookCardData; index: number }) => {
    const card = <BookCardItem book={item} onOpenMenu={handleOpenBookMenu} />;
    if (index === 0) {
      return (
        <View 
          style={{ width: '100%' }}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            if (height > 0) {
              setFirstItemHeight(prev => (Math.abs(prev - height) > 2 ? height : prev));
            }
          }}
        >
          {card}
        </View>
      );
    }
    return card;
  }, [handleOpenBookMenu]);

  const renderAuthorItem = useCallback(({ item, index }: { item: AuthorCardData; index: number }) => {
    const card = <AuthorCardItem author={item} />;
    if (index === 0) {
      return (
        <View 
          style={{ width: '100%' }}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            if (height > 0) {
              setFirstItemHeight(prev => (Math.abs(prev - height) > 2 ? height : prev));
            }
          }}
        >
          {card}
        </View>
      );
    }
    return card;
  }, []);

  const renderThemeItem = useCallback(({ item, index }: { item: ThemeCardData; index: number }) => {
    const card = <ThemeCardItem theme={item} />;
    if (index === 0) {
      return (
        <View 
          style={{ width: '100%' }}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            if (height > 0) {
              setFirstItemHeight(prev => (Math.abs(prev - height) > 2 ? height : prev));
            }
          }}
        >
          {card}
        </View>
      );
    }
    return card;
  }, []);

  const quoteKeyExtractor = useCallback((item: Quote) => item.id.toString(), []);
  const bookKeyExtractor = useCallback((item: BookCardData) => item.title, []);
  const authorKeyExtractor = useCallback((item: AuthorCardData) => item.name, []);
  const themeKeyExtractor = useCallback((item: ThemeCardData) => item.theme, []);
  const statsContent = (
    <>
      <CounterTab
        value={myQuotes.length}
        label="Citations"
        isActive={viewMode === 'quotes'}
        onPress={() => setViewMode('quotes')}
        activeOpacity={0.8}
        accessible={true}
        accessibilityRole="tab"
        accessibilityState={{ selected: viewMode === 'quotes' }}
        accessibilityLabel={`Onglet Citations, ${myQuotes.length} citations`}
        testID="tab-quotes"
      />
      <CounterTab
        value={bookCount}
        label="Livres"
        isActive={viewMode === 'books'}
        onPress={() => setViewMode('books')}
        activeOpacity={0.8}
        accessible={true}
        accessibilityRole="tab"
        accessibilityState={{ selected: viewMode === 'books' }}
        accessibilityLabel={`Onglet Livres, ${bookCount} livres`}
        testID="tab-books"
      />
      <CounterTab
        value={authorsData.length}
        label="Auteurs"
        isActive={viewMode === 'authors'}
        onPress={() => setViewMode('authors')}
        activeOpacity={0.8}
        accessible={true}
        accessibilityRole="tab"
        accessibilityState={{ selected: viewMode === 'authors' }}
        accessibilityLabel={`Onglet Auteurs, ${authorsData.length} auteurs`}
        testID="tab-authors"
      />
      <CounterTab
        value={themes.length}
        label="Thèmes"
        isActive={viewMode === 'themes'}
        onPress={() => setViewMode('themes')}
        activeOpacity={0.8}
        accessible={true}
        accessibilityRole="tab"
        accessibilityState={{ selected: viewMode === 'themes' }}
        accessibilityLabel={`Onglet Thèmes, ${themes.length} thèmes`}
        testID="tab-themes"
      />
    </>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedHeaderTitle viewMode={viewMode} colors={colors} styles={styles} />
        <View style={styles.headerRight}>
          <InteractiveTooltip
            text="Le bouton + permet de rajouter une citation manuellement."
            stepName="addQuoteButton"
            placement="bottom"
          >
            <IconButton
              icon={<Plus size={20} color={colors.primary} />}
              variant="outline"
              size="md"
              onPress={() => setShowAddMenu(true)}
              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface }}
              accessibilityLabel="Ajouter une citation"
              testID="add-quote-btn"
            />
          </InteractiveTooltip>
          <InteractiveTooltip
            text="Vous pouvez rechercher les œuvres/auteurs de votre choix et les ajouter à votre bibliothèque."
            stepName="searchButton"
            placement="bottom"
          >
            <IconButton
              icon={<Search size={20} color={colors.textSecondary} />}
              variant="outline"
              size="md"
              onPress={() => router.navigate('/search')}
              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface }}
              accessibilityLabel="Rechercher"
              testID="search-btn"
            />
          </InteractiveTooltip>
          <IconButton
            icon={<Filter size={20} color={activeFilters.length > 0 ? colors.primary : colors.textSecondary} />}
            variant="outline"
            size="md"
            onPress={() => { setTempFilters([...activeFilters]); setFilterModalVisible(true); }}
            style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface }}
            accessibilityLabel="Filtrer"
            testID="filter-btn"
          />
        </View>
      </View>

      {/* Stats */}
      <InteractiveTooltip
        stepName="filterTabs"
        text="Vos citations sont regroupées par catégorie : Citations, Livres, Auteurs et Thèmes. Appuyez sur un onglet pour changer de vue."
        placement="bottom"
        allowChildInteraction={true}
        verticalOffset={firstItemHeight + 20}
      >
        {quotesToDisplay.length === 0 ? (
          <InteractiveTooltip
            text="Les citations enregistrées se retrouvent ici."
            stepName="myQuotesList"
            placement="bottom"
          >
            <View style={[styles.stats, { width: '100%' }]}>
              {statsContent}
            </View>
          </InteractiveTooltip>
        ) : (
          <View style={[styles.stats, { width: '100%' }]}>
            {statsContent}
          </View>
        )}
      </InteractiveTooltip>

      {/* Content — FlashList for virtualization */}
      <View style={styles.scrollView}>
        <View style={viewMode === 'books' ? styles.listContainerActive : styles.listContainerHidden}>
          <FlashList
            data={filteredBooksByStatus}
            renderItem={renderBookItem}
            keyExtractor={bookKeyExtractor}
            getItemType={() => 'book'}
            removeClippedSubviews={true}
            contentContainerStyle={styles.scrollContent}
            alwaysBounceVertical={true}
            ListHeaderComponent={
              <ListHeaderMemo
                activeFilters={activeFilters}
                viewMode="books"
                selectedStatus={selectedStatus}
                colors={colors}
                styles={styles}
                removeFilter={removeFilter}
                resetFilters={resetFilters}
                setSelectedStatus={setSelectedStatus}
              />
            }
            ListEmptyComponent={
              <EmptyStateView
                icon={hasActiveBookFilters ? <Filter size={32} color={colors.primary} /> : <BookIcon size={32} color={colors.primary} />}
                title={hasActiveBookFilters ? "Aucun livre trouvé" : "Vos étagères sont vides"}
                description={
                  hasActiveBookFilters
                    ? "Aucun livre ne correspond aux filtres ou au statut de lecture sélectionné."
                    : "Ajoutez un livre ou une première citation pour créer votre bibliothèque numérique."
                }
                buttonLabel={hasActiveBookFilters ? "Réinitialiser les filtres" : "+ Ajouter un livre"}
                onButtonPress={hasActiveBookFilters ? () => { resetFilters(); setSelectedStatus('ALL'); } : () => router.push({ pathname: '/search', params: { tab: 'books' } })}
                styles={styles}
              />
            }
            ListFooterComponent={
              filteredBooksByStatus.length > 0 ? (
                <AddFooterCard
                  label="Ajouter un livre"
                  icon={<Plus size={22} color={colors.primary} />}
                  onPress={() => router.push({ pathname: '/search', params: { tab: 'books' } })}
                  styles={styles}
                />
              ) : null
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          />
        </View>

        <View style={viewMode === 'authors' ? styles.listContainerActive : styles.listContainerHidden}>
          <FlashList
            data={authorsData}
            renderItem={renderAuthorItem}
            keyExtractor={authorKeyExtractor}
            getItemType={() => 'author'}
            removeClippedSubviews={true}
            contentContainerStyle={styles.scrollContent}
            alwaysBounceVertical={true}
            ListHeaderComponent={
              <ListHeaderMemo
                activeFilters={activeFilters}
                viewMode="authors"
                selectedStatus={selectedStatus}
                colors={colors}
                styles={styles}
                removeFilter={removeFilter}
                resetFilters={resetFilters}
                setSelectedStatus={setSelectedStatus}
              />
            }
            ListEmptyComponent={
              <EmptyStateView
                icon={hasActiveAuthorFilters ? <Filter size={32} color={colors.primary} /> : <Users size={32} color={colors.primary} />}
                title={hasActiveAuthorFilters ? "Aucun auteur trouvé" : "Votre panthéon d'auteurs est vide"}
                description={
                  hasActiveAuthorFilters
                    ? "Aucun auteur ne correspond à vos critères de filtre actuels."
                    : "Vos auteurs favoris s'afficheront automatiquement ici dès que vous ajouterez des livres et des citations."
                }
                buttonLabel={hasActiveAuthorFilters ? "Réinitialiser les filtres" : "+ Ajouter un auteur"}
                onButtonPress={hasActiveAuthorFilters ? resetFilters : () => router.push({ pathname: '/search', params: { tab: 'authors' } })}
                styles={styles}
              />
            }
            ListFooterComponent={
              authorsData.length > 0 ? (
                <AddFooterCard
                  label="Ajouter un auteur"
                  icon={<Plus size={22} color={colors.primary} />}
                  onPress={() => router.push({ pathname: '/search', params: { tab: 'authors' } })}
                  styles={styles}
                />
              ) : null
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          />
        </View>

        <View style={viewMode === 'themes' ? styles.listContainerActive : styles.listContainerHidden}>
          <FlashList
            data={themes}
            renderItem={renderThemeItem}
            keyExtractor={themeKeyExtractor}
            getItemType={() => 'theme'}
            removeClippedSubviews={true}
            contentContainerStyle={styles.scrollContent}
            alwaysBounceVertical={true}
            ListHeaderComponent={
              <ListHeaderMemo
                activeFilters={activeFilters}
                viewMode="themes"
                selectedStatus={selectedStatus}
                colors={colors}
                styles={styles}
                removeFilter={removeFilter}
                resetFilters={resetFilters}
                setSelectedStatus={setSelectedStatus}
              />
            }
            ListEmptyComponent={
              <EmptyStateView
                icon={hasActiveThemeFilters ? <Filter size={32} color={colors.primary} /> : <Hash size={32} color={colors.primary} />}
                title={hasActiveThemeFilters ? "Aucun thème trouvé" : "Aucun thème répertorié"}
                description={
                  hasActiveThemeFilters
                    ? "Aucun thème ne correspond aux filtres sélectionnés."
                    : "Associez des thèmes à vos citations (philosophie, amour, science...) pour les retrouver facilement regroupées ici."
                }
                buttonLabel={hasActiveThemeFilters ? "Réinitialiser les filtres" : "+ Ajouter une citation"}
                onButtonPress={hasActiveThemeFilters ? resetFilters : () => setShowAddMenu(true)}
                styles={styles}
              />
            }
            ListFooterComponent={
              themes.length > 0 ? (
                <AddFooterCard
                  label="Ajouter une citation"
                  icon={<Plus size={22} color={colors.primary} />}
                  onPress={() => setShowAddMenu(true)}
                  styles={styles}
                />
              ) : null
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          />
        </View>

        <View style={viewMode === 'quotes' ? styles.listContainerActive : styles.listContainerHidden}>
          <FlashList
            ref={quotesListRef}
            data={quotesToDisplay}
            renderItem={renderQuoteItem}
            keyExtractor={quoteKeyExtractor}
            getItemType={() => 'quote'}
            removeClippedSubviews={true}
            contentContainerStyle={styles.scrollContent}
            alwaysBounceVertical={true}
            ListHeaderComponent={
              <ListHeaderMemo
                activeFilters={activeFilters}
                viewMode="quotes"
                selectedStatus={selectedStatus}
                colors={colors}
                styles={styles}
                removeFilter={removeFilter}
                resetFilters={resetFilters}
                setSelectedStatus={setSelectedStatus}
                quoteSubFilter={quoteSubFilter}
                setQuoteSubFilter={setQuoteSubFilter}
              />
            }
            ListEmptyComponent={
              (() => {
                if (activeFilters.length > 0) {
                  return (
                    <EmptyStateView
                      icon={<Filter size={32} color={colors.primary} />}
                      title="Aucune citation trouvée"
                      description="Aucune citation ne correspond aux filtres sélectionnés."
                      buttonLabel="Réinitialiser les filtres"
                      onButtonPress={() => resetFilters()}
                      styles={styles}
                    />
                  );
                }

                if (quoteSubFilter === 'SAVED') {
                  return (
                    <EmptyStateView
                      icon={<Bookmark size={32} color={colors.primary} />}
                      title="Aucune citation enregistrée"
                      description="Enregistrez des citations partagées par d'autres utilisateurs depuis le fil d'actualités pour les retrouver ici."
                      styles={styles}
                    />
                  );
                }

                if (quoteSubFilter === 'PUBLISHED') {
                  return (
                    <EmptyStateView
                      icon={<QuoteIcon size={32} color={colors.primary} />}
                      title="Aucune citation publiée"
                      description="Vous n'avez pas encore publié de citations. Scannez ou ajoutez vos propres citations pour créer votre collection."
                      buttonLabel="+ Ajouter une citation"
                      onButtonPress={() => setShowAddMenu(true)}
                      styles={styles}
                    />
                  );
                }

                return (
                  <EmptyStateView
                    icon={<QuoteIcon size={32} color={colors.primary} />}
                    title="Votre carnet est encore vierge"
                    description="Scannez un extrait de livre ou créez manuellement votre première citation pour lancer votre collection."
                    buttonLabel="+ Ajouter une citation"
                    onButtonPress={() => setShowAddMenu(true)}
                    styles={styles}
                  />
                );
              })()
            }
            ListFooterComponent={
              quotesToDisplay.length > 0 ? (
                <AddFooterCard
                  label="Ajouter une citation"
                  icon={<Plus size={22} color={colors.primary} />}
                  onPress={() => setShowAddMenu(true)}
                  styles={styles}
                />
              ) : null
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          />
        </View>
      </View>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        authors={authors}
        books={books.map(b => b.title)}
        years={years}
        tempFilters={tempFilters}
        onToggleTempFilter={toggleTempFilter}
        onApplyFilters={applyFilters}
        onResetTempFilters={() => setTempFilters([])}
      />

      <ScanPreviewModal
        visible={showManualQuoteModal}
        onClose={() => {
          setShowManualQuoteModal(false);
          setEditingQuote(null);
          setScannedText('');
        }}
        onConfirm={async (text, book, author) => {
          await handleConfirmSave(text, book, author, {
            setShowModal: setShowManualQuoteModal,
            editingQuote,
            setEditingQuote,
            isFromScanner: false,
          });
          scrollToQuotesTop();
        }}
        scannedText={editingQuote ? editingQuote.text : scannedText}
        initialBook={editingQuote ? getBookTitle(editingQuote.book) : ""}
        initialAuthor={editingQuote ? getAuthorName(editingQuote.author) : ""}
      />

      <SimpleScanModal
        visible={showSimpleScanModal}
        onClose={() => setShowSimpleScanModal(false)}
        onSuccess={(result) => {
          setShowSimpleScanModal(false);
          setEditingQuote(null);
          setTimeout(() => {
            setActiveScanResult(result);
          }, Platform.OS === 'ios' ? 350 : 50);
        }}
      />

      <Modal
        visible={!!activeScanResult}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveScanResult(null)}
      >
        {activeScanResult && (
          <ScanWorkflow
            photo={activeScanResult.photo}
            ocrElements={activeScanResult.ocrElements}
            ocrBlocks={activeScanResult.ocrBlocks}
            onReset={() => setActiveScanResult(null)}
            normalizedSize={activeScanResult.normalizedSize}
            onSave={async (text, book, author) => {
              try {
                await handleConfirmSave(text, book || '', author || '', {
                  isFromScanner: false,
                });
                setActiveScanResult(null);
                scrollToQuotesTop();
                return { success: true };
              } catch (e) {
                return { success: false, error: e instanceof Error ? e.message : String(e) };
              }
            }}
          />
        )}
      </Modal>

      <QuoteActionModal
        visible={!!actionMenuQuote}
        onClose={() => setActionMenuQuote(null)}
        isSavedQuote={!!(actionMenuQuote?.user && actionMenuQuote.user?.id !== currentUser?.id && actionMenuQuote.isSaved)}
        onEdit={() => {
          if (actionMenuQuote) {
            const quote = actionMenuQuote;
            setActionMenuQuote(null);
            setTimeout(() => {
              setEditingQuote(quote);
              setShowManualQuoteModal(true);
            }, Platform.OS === 'ios' ? 350 : 50);
          }
        }}
        onDelete={() => {
          if (actionMenuQuote) {
            const quote = actionMenuQuote;
            setActionMenuQuote(null);
            setTimeout(() => {
              if (quote.user && quote.user?.id !== currentUser?.id && quote.isSaved) {
                toggleSaveQuote(quote.id);
              } else {
                deleteQuote(quote.id);
              }
            }, Platform.OS === 'ios' ? 350 : 50);
          }
        }}
      />

      <BookActionModal
        visible={!!actionMenuBook}
        onClose={() => setActionMenuBook(null)}
        onChangeStatus={() => {
          if (actionMenuBook) {
            const book = actionMenuBook;
            setActionMenuBook(null);
            setTimeout(() => {
              handleOpenBookStatusMenu(book);
            }, Platform.OS === 'ios' ? 350 : 50);
          }
        }}
        onDelete={() => {
          if (actionMenuBook) {
            const book = actionMenuBook;
            setActionMenuBook(null);
            setTimeout(() => {
              handleDeleteBook(book);
            }, Platform.OS === 'ios' ? 350 : 50);
          }
        }}
      />

      <AddQuoteMenu
        visible={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        onScanPress={() => {
          setShowAddMenu(false);
          setTimeout(() => {
            setShowSimpleScanModal(true);
          }, Platform.OS === 'ios' ? 350 : 50);
        }}
        onManualAddPress={() => {
          setEditingQuote(null);
          setScannedText('');
          setShowManualQuoteModal(true);
        }}
      />
    </SafeAreaView >
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeftContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  absoluteHeaderLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    gap: 6,
  },
  filterBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  statusFilterContainer: {
    marginTop: -4,
    marginBottom: 4,
  },
  statusFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexGrow: 1,
    justifyContent: 'center',
  },
  statusFilterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.surfaceHighlight,
    backgroundColor: colors.surface,
  },
  statusFilterBadgeActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  statusFilterText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statusFilterTextActive: {
    color: colors.primary,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    marginTop: 20,
  },
  emptyStateIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: defaultTokens.typography.fontSize.heading,
    lineHeight: defaultTokens.typography.lineHeight.heading,
    fontFamily: defaultTokens.typography.fontFamily.display,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyStateButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.primary,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addFooterCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 40,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFooterIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  addFooterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyStateText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  clearFilterButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
    gap: 24,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  listContainerActive: {
    flex: 1,
  },
  listContainerHidden: {
    display: 'none',
  },
});
