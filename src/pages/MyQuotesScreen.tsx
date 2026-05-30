import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useAuth } from '@/src/app/providers/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { Search, Filter, X, ChevronDown, Trash2, Edit3, Plus, MoreVertical, Camera, Quote as QuoteIcon, Users, Hash, Book as BookIcon } from 'lucide-react-native';
import { bookDescriptions } from '@/src/shared/api/staticData';
import ScanPreviewModal from '@/src/features/scanner/ui/ScanPreviewModal';
import { useTabIndex } from '@/src/app/providers/TabContext';

import { useData } from '@/src/app/providers/DataProvider';
import { Quote, Book } from '@/src/shared/api/types';
import { getBookTitle, getAuthorName, getStatusColor, getStatusLabel, STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { useQuoteActions } from '@/src/entities/quote/lib';

// Extracted components
import QuoteCard from '@/src/entities/quote/ui/QuoteCard';
import BookCardItem from '@/src/entities/book/ui/BookCardItem';
import AuthorCardItem from '@/src/entities/author/ui/AuthorCardItem';
import ThemeCardItem from '@/src/entities/theme/ui/ThemeCardItem';
import QuoteActionModal from '@/src/entities/quote/ui/QuoteActionModal';
import AddQuoteMenu from '@/src/entities/quote/ui/AddQuoteMenu';
import FilterModal, { FilterType } from '@/src/entities/quote/ui/FilterModal';

export default function MyQuotesScreen() {
  const router = useRouter();
  const { navigateToBook, navigateToAuthor } = useSmartNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { quotes: allQuotes, authors: allAuthors, books: allBooks, toggleLikeQuote, deleteQuote, refreshQuotes, refreshAuthors, refreshBooks } = useData();
  const { handleConfirmSave } = useQuoteActions();
  const { tabIndex, setTabIndex } = useTabIndex();

  // Ref pour scroller vers le haut après un ajout via le scanner
  const quotesListRef = useRef<any>(null);

  const { user: currentUser } = useAuth();
  
  // Filter for "My Quotes" (current user matches their UUID)
  const myQuotes = useMemo(() => allQuotes.filter(q => q.user?.id === currentUser?.id), [allQuotes, currentUser]);

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
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshQuotes(),
        refreshAuthors(),
        refreshBooks()
      ]);
    } catch (error) {
      console.error("Refresh failed", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshQuotes, refreshAuthors, refreshBooks]);

  const isScreenFocused = useIsFocused();

  useEffect(() => {
    if (isScreenFocused && isFocused) {
      setTabIndex(0);
      refreshQuotes();
      refreshAuthors();
      refreshBooks();
    }
  }, [isScreenFocused, isFocused]);

  // Avec Realtime implémenté dans QuoteCard, le polling global n'est plus nécessaire
  // Chaque QuoteCard gère ses propres mises à jour en temps réel
  // Ce code est gardé en commentaire au cas où on voudrait le réactiver
  /*
  const hasEnrichingItems = useMemo(() => myQuotes.some(q => {
    const isBookEnriching = q.book && typeof q.book === 'object' && (q.book as any).isEnriching;
    const isAuthorEnriching = q.author && typeof q.author === 'object' && (q.author as any).isEnriching;
    if (!isBookEnriching && !isAuthorEnriching) return false;
    const quoteAge = q.date ? Date.now() - new Date(q.date).getTime() : 0;
    if (quoteAge > 30000) return false;
    return true;
  }), [myQuotes]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (hasEnrichingItems && isFocused) {
      interval = setInterval(() => {
        refreshQuotes();
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [hasEnrichingItems, isFocused, refreshQuotes]);
  */

  const [showManualQuoteModal, setShowManualQuoteModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [tempFilters, setTempFilters] = useState<FilterType[]>([]);
  const [expandedSection, setExpandedSection] = useState<'author' | 'book' | 'year' | 'status' | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'quotes' | 'books' | 'themes' | 'authors'>('quotes');
  const fadeAnim = useSharedValue(1);

  useEffect(() => {
    fadeAnim.value = 0;
    fadeAnim.value = withTiming(1, { duration: 300 });
  }, [viewMode]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  // Memoized derived data
  const authors = useMemo(() => [...new Set(myQuotes.map(q => getAuthorName(q.author)))], [myQuotes]);
  const books = useMemo(() => [...new Set(myQuotes.map(q => getBookTitle(q.book)))], [myQuotes]);
  const years = useMemo(() => [...new Set(
    myQuotes
      .map(q => bookDescriptions[getBookTitle(q.book)]?.year)
      .filter((year): year is number => !!year)
  )].sort((a, b) => b - a), [myQuotes]);

  const bookCount = useMemo(() => new Set(myQuotes.map(q => getBookTitle(q.book))).size, [myQuotes]);

  // Liste des thèmes (notion abordée)
  const themes = useMemo(() => {
    const grouped: Record<string, { books: Set<string>; quoteCount: number }> = {};
    for (const q of myQuotes) {
      const theme = q.theme || 'Thème non renseigné';
      if (!grouped[theme]) grouped[theme] = { books: new Set(), quoteCount: 0 };
      grouped[theme].books.add(getBookTitle(q.book));
      grouped[theme].quoteCount += 1;
    }
    return Object.entries(grouped)
      .map(([theme, data]) => ({
        theme,
        books: Array.from(data.books),
        quoteCount: data.quoteCount,
      }))
      .sort((a, b) => a.theme.localeCompare(b.theme));
  }, [myQuotes]);

  // Derived filtered quotes — useMemo instead of useState+useEffect
  const quotesToDisplay = useMemo(() => {
    let filtered = [...myQuotes];
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
  }, [myQuotes, activeFilters, allBooks]);

  // Sync temp filters when active filters change
  useEffect(() => {
    setTempFilters([...activeFilters]);
  }, [activeFilters]);

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
    setExpandedSection(null);
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
      setExpandedSection(null);
    }
  }, [filterModalVisible]);

  const handleOpenMenu = useCallback((quote: Quote) => {
    setActionMenuQuote(quote);
  }, []);

  const booksData = useMemo(() => {
    const grouped = myQuotes.reduce<Record<string, { authors: Set<string>; quoteCount: number; bookObj?: Book }>>((acc, quote) => {
      const title = getBookTitle(quote.book);
      const author = getAuthorName(quote.author);
      if (!acc[title]) {
        acc[title] = { authors: new Set(), quoteCount: 0 };
      }
      acc[title].authors.add(author);
      acc[title].quoteCount += 1;
      if (quote.book && typeof quote.book !== 'string') {
        acc[title].bookObj = quote.book;
      }
      return acc;
    }, {});

    // Ensure we include books who are explicitly saved by the user or have quotes
    allBooks.forEach(book => {
      if (grouped[book.title]) {
        grouped[book.title].bookObj = book;
      } else if (book.isSaved) {
        const authorName = getAuthorName(book.author);
        grouped[book.title] = {
          authors: new Set([authorName]),
          quoteCount: 0,
          bookObj: book
        };
      }
    });

    return Object.entries(grouped)
      .map(([bookTitle, data]) => {
        const meta = bookDescriptions[bookTitle] || data.bookObj;
        return {
          title: bookTitle,
          id: data.bookObj?.id,
          authors: Array.from(data.authors),
          quoteCount: data.quoteCount,
          year: meta?.year,
          description: meta?.description,
          cover: meta?.cover,
          readingStatus: data.bookObj?.readingStatus,
          inventaireUri: data.bookObj?.inventaireUri,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [myQuotes, allBooks]);

  const filteredBooksByStatus = useMemo(() => {
    if (selectedStatus === 'ALL') return booksData;
    return booksData.filter(b => b.readingStatus === selectedStatus);
  }, [booksData, selectedStatus]);

  const authorsData = useMemo(() => {
    const grouped = myQuotes.reduce<Record<string, { author: any; quoteCount: number }>>((acc, quote) => {
      const name = getAuthorName(quote.author);
      if (!acc[name]) {
        acc[name] = { author: quote.author, quoteCount: 0 };
      } else if (typeof acc[name].author === 'string' && typeof quote.author !== 'string') {
        acc[name].author = quote.author;
      }
      acc[name].quoteCount += 1;
      return acc;
    }, {});

    // Ensure we include authors who are explicitly saved by the user
    allAuthors.forEach(author => {
      if (author.isSaved && !grouped[author.name]) {
        grouped[author.name] = { author: author, quoteCount: 0 };
      }
    });

    return Object.values(grouped)
      .map((data: any) => ({
        name: getAuthorName(data.author),
        image: typeof data.author !== 'string' ? data.author?.image : null,
        quoteCount: data.quoteCount,
        inventaireUri: typeof data.author !== 'string' ? data.author?.inventaireUri : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [myQuotes, allAuthors]);

  const toggleSection = useCallback((section: 'author' | 'book' | 'year' | 'status' | null) => {
    setExpandedSection(current => (current === section ? null : section));
  }, []);

  // Render items for FlashList
  const renderQuoteItem = useCallback(({ item }: { item: Quote }) => (
    <QuoteCard
      quote={item}
      onToggleLike={toggleLikeQuote}
      onOpenMenu={handleOpenMenu}
    />
  ), [toggleLikeQuote, handleOpenMenu]);

  const renderBookItem = useCallback(({ item }: { item: any }) => (
    <BookCardItem book={item} />
  ), []);

  const renderAuthorItem = useCallback(({ item }: { item: any }) => (
    <AuthorCardItem author={item} />
  ), []);

  const renderThemeItem = useCallback(({ item }: { item: any }) => (
    <ThemeCardItem theme={item} />
  ), []);

  const quoteKeyExtractor = useCallback((item: Quote) => item.id.toString(), []);
  const bookKeyExtractor = useCallback((item: any) => item.title, []);
  const authorKeyExtractor = useCallback((item: any) => item.name, []);
  const themeKeyExtractor = useCallback((item: any) => item.theme, []);

  // Header component for FlashList (filters + status pills)
  const ListHeader = useMemo(() => {
    const elements: React.ReactNode[] = [];
    
    if (activeFilters.length > 0) {
      elements.push(
        <View key="filters" style={styles.filterContainer}>
          {activeFilters.map((filter, index) => (
            <TouchableOpacity key={`${filter.type}-${filter.value}-${index}`} style={styles.filterBadge} onPress={() => removeFilter(filter)}>
              <Text style={styles.filterBadgeText}>
                {filter.type === 'author' ? 'Auteur' :
                  filter.type === 'book' ? 'Livre' :
                    filter.type === 'year' ? 'Année' : 'Statut'}: {
                  filter.type === 'status' ? getStatusLabel(filter.value as string) : filter.value
                }
              </Text>
              <X size={12} color={colors.primary} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={resetFilters} style={styles.clearFilterButton}><Text style={styles.clearFilterButtonText}>Tout effacer</Text></TouchableOpacity>
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
              <Text style={[
                styles.statusFilterText,
                selectedStatus === 'ALL' && styles.statusFilterTextActive
              ]}>Tout</Text>
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
                <Text style={[
                  styles.statusFilterText,
                  selectedStatus === opt.value && { color: opt.color, fontWeight: '700' }
                ]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }

    return elements.length > 0 ? <>{elements}</> : null;
  }, [activeFilters, viewMode, selectedStatus, colors, styles, removeFilter, resetFilters]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.headerLeft, fadeStyle]}>
          {viewMode === 'quotes' && <QuoteIcon size={24} color={colors.text} />}
          {viewMode === 'books' && <BookIcon size={24} color={colors.text} />}
          {viewMode === 'authors' && <Users size={24} color={colors.text} />}
          {viewMode === 'themes' && <Hash size={24} color={colors.text} />}
          <Text style={styles.headerTitle}>
            {viewMode === 'quotes' && 'Mes Citations'}
            {viewMode === 'books' && 'Mes Livres'}
            {viewMode === 'authors' && 'Mes Auteurs'}
            {viewMode === 'themes' && 'Mes Thèmes'}
          </Text>
        </Animated.View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowAddMenu(true)}>
            <Plus size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.navigate('/search')}>
            <Search size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => { setTempFilters([...activeFilters]); setFilterModalVisible(true); }}>
            <Filter size={20} color={activeFilters.length > 0 ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <TouchableOpacity
          style={[styles.statItem, viewMode === 'quotes' && styles.statItemActive]}
          onPress={() => setViewMode('quotes')}
          activeOpacity={0.8}
        >
          <Text style={styles.statValue}>{myQuotes.length}</Text>
          <Text style={styles.statLabel}>Citations</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statItem, viewMode === 'books' && styles.statItemActive]}
          onPress={() => setViewMode('books')}
          activeOpacity={0.8}
        >
          <Text style={styles.statValue}>{bookCount}</Text>
          <Text style={styles.statLabel}>Livres</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statItem, viewMode === 'authors' && styles.statItemActive]}
          onPress={() => setViewMode('authors')}
          activeOpacity={0.8}
        >
          <Text style={styles.statValue}>{authorsData.length}</Text>
          <Text style={styles.statLabel}>Auteurs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statItem, viewMode === 'themes' && styles.statItemActive]}
          onPress={() => setViewMode('themes')}
          activeOpacity={0.8}
        >
          <Text style={styles.statValue}>{themes.length}</Text>
          <Text style={styles.statLabel}>Thèmes</Text>
        </TouchableOpacity>
      </View>

      {/* Content — FlashList for virtualization */}
      <View style={styles.scrollView}>
        {viewMode === 'books' ? (
          <FlashList
            data={filteredBooksByStatus}
            renderItem={renderBookItem}
            keyExtractor={bookKeyExtractor}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={<Text style={styles.emptyStateText}>Aucun livre à afficher avec ces filtres.</Text>}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          />
        ) : viewMode === 'authors' ? (
          <FlashList
            data={authorsData}
            renderItem={renderAuthorItem}
            keyExtractor={authorKeyExtractor}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={<Text style={styles.emptyStateText}>Aucun auteur à afficher avec ces filtres.</Text>}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          />
        ) : viewMode === 'themes' ? (
          <FlashList
            data={themes}
            renderItem={renderThemeItem}
            keyExtractor={themeKeyExtractor}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={<Text style={styles.emptyStateText}>Aucun thème à afficher avec ces filtres.</Text>}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          />
        ) : (
          <FlashList
            ref={quotesListRef}
            data={quotesToDisplay}
            renderItem={renderQuoteItem}
            keyExtractor={quoteKeyExtractor}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={ListHeader}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            }
          />
        )}
      </View>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        authors={authors}
        books={books}
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
        }}
        onConfirm={async (text, book, author) => {
          await handleConfirmSave(text, book, author, {
            setShowModal: setShowManualQuoteModal,
            editingQuote,
            setEditingQuote,
            isFromScanner: false,
          });
        }}
        scannedText={editingQuote ? editingQuote.text : ""}
        initialBook={editingQuote ? getBookTitle(editingQuote.book) : ""}
        initialAuthor={editingQuote ? getAuthorName(editingQuote.author) : ""}
      />

      <QuoteActionModal
        visible={!!actionMenuQuote}
        onClose={() => setActionMenuQuote(null)}
        onEdit={() => {
          if (actionMenuQuote) {
            setEditingQuote(actionMenuQuote);
            setShowManualQuoteModal(true);
          }
        }}
        onDelete={() => {
          if (actionMenuQuote) {
            deleteQuote(actionMenuQuote.id);
          }
        }}
      />

      <AddQuoteMenu
        visible={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        onScanPress={() => router.navigate('/scan')}
        onManualAddPress={() => {
          setEditingQuote(null);
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
    borderColor: colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 4,
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  statValue: {
    fontSize: 18,
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  actionMenuContainer: {
    width: '80%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionMenuTitle: {
    fontSize: 18,
    color: colors.text,
    fontWeight: 'bold',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighlight,
  },
  actionMenuText: {
    fontSize: 16,
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: colors.text,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighlight,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  filterOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  filterOptionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  filterOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  resetButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
  },
  resetButtonText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  applyButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  applyButtonText: {
    color: colors.buttonText,
    textAlign: 'center',
    fontWeight: '600',
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
    fontWeight: '700',
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
});