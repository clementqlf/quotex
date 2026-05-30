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

import { Quote, Book } from '@/src/shared/api/types';
import { getBookTitle, getAuthorName, getStatusColor, getStatusLabel, STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { useQuoteActions } from '@/src/entities/quote/lib';

// Entity components - OK to import from entities per FSD
import QuoteCard from '@/src/entities/quote/ui/QuoteCard';
import BookCardItem from '@/src/entities/book/ui/BookCardItem';
import AuthorCardItem from '@/src/entities/author/ui/AuthorCardItem';
import ThemeCardItem from '@/src/entities/theme/ui/ThemeCardItem';
import QuoteActionModal from '@/src/entities/quote/ui/QuoteActionModal';
import AddQuoteMenu from '@/src/entities/quote/ui/AddQuoteMenu';
import FilterModal, { FilterType } from '@/src/entities/quote/ui/FilterModal';

// Feature hook
import { useMyQuotes } from '../model/useMyQuotes';

export default function MyQuotesScreen() {
  const router = useRouter();
  const { navigateToBook, navigateToAuthor } = useSmartNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // Feature hook - découplé de DataProvider
  const { 
    myQuotes, 
    allAuthors, 
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
  const { tabIndex, setTabIndex } = useTabIndex();

  const { user: currentUser } = useAuth();
  
  // Ref pour scroller vers le haut après un ajout via le scanner
  const quotesListRef = useRef<any>(null);

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
      await refreshMyQuotes();
    } catch (error) {
      console.error("Refresh failed", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshMyQuotes]);

  const isScreenFocused = useIsFocused();

  useEffect(() => {
    if (isScreenFocused && isFocused) {
      setTabIndex(0);
      refreshMyQuotes();
    }
  }, [isScreenFocused, isFocused, refreshMyQuotes, setTabIndex]);

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

  // Memoized derived data - utilisant les getters du hook feature
  const authors = useMemo(() => getAuthors(), [getAuthors]);
  const books = useMemo(() => getBooksData(), [getBooksData]);
  const bookCount = useMemo(() => getBookCount(), [getBookCount]);
  
  const years = useMemo(() => {
    return [...new Set(
      myQuotes
        .map(q => bookDescriptions[getBookTitle(q.book)]?.year)
        .filter((year): year is number => !!year)
    )].sort((a, b) => b - a);
  }, [myQuotes]);

  // Liste des thèmes
  const themes = useMemo(() => getThemes(), [getThemes]);

  // Derived filtered quotes
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

  // Authors data
  const authorsData = useMemo(() => getAuthorsData(), [getAuthorsData]);

  const filteredBooksByStatus = useMemo(() => {
    if (selectedStatus === 'ALL') return books;
    return books.filter(b => b.readingStatus === selectedStatus);
  }, [books, selectedStatus]);

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
