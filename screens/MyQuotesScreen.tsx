import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  PanResponder,
  Share,
  RefreshControl,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence
} from 'react-native-reanimated';
import { useAuth } from '@/src/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSmartNavigation } from '@/src/hooks/useSmartNavigation';
import { BookOpen, Search, Filter, Heart, Share2, X, ChevronDown, Trash2, Edit3, Plus, MoreVertical, Camera, Quote as QuoteIcon, Users, Hash, Book as BookIcon } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { bookDescriptions } from '../data/staticData';
import ScanPreviewModal from '@/components/ScanPreviewModal';
import { useTabIndex } from '@/src/contexts/TabContext';

import { useData } from '@/src/contexts/DataProvider';
import { Quote, Book } from '@/types';
import { getBookTitle, getAuthorName, getStatusColor, getStatusLabel, STATUS_OPTIONS } from '@/src/utils/dataHelpers';
import { formatRelativeDate } from '@/src/utils/dateUtils';
import { useTheme } from '@/src/contexts/ThemeContext';
import { ThemeColors } from '@/src/theme/theme';

type FilterType = { type: 'author' | 'book' | 'year' | 'status'; value: string | number };
const EDGE_SWIPE_ZONE = 28;
const SWIPE_ACTIVATION_THRESHOLD = 60;

export default function MyQuotesScreen() {
  const router = useRouter();
  const { navigateToBook, navigateToAuthor } = useSmartNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { quotes: allQuotes, authors: allAuthors, books: allBooks, toggleLikeQuote, deleteQuote, refreshQuotes, refreshAuthors, refreshBooks, addQuote, updateQuote } = useData();

  const { user: currentUser } = useAuth();
  
  // Filter for "My Quotes" (current user matches their UUID)
  const myQuotes = useMemo(() => allQuotes.filter(q => q.user?.id === currentUser?.id), [allQuotes, currentUser]);

  const [quotesToDisplay, setQuotesToDisplay] = useState(myQuotes);

  const { tabIndex, setTabIndex } = useTabIndex();
  const isFocused = tabIndex === 0;
  const scrollViewRef = useRef<ScrollView>(null);

  // Edit State
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [actionMenuQuote, setActionMenuQuote] = useState<Quote | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
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

  useEffect(() => {
    if (isFocused) {
      setTabIndex(0);
      refreshQuotes();
      refreshAuthors();
      refreshBooks();
    }
  }, [isFocused]);

  // Polling logic to automatically clear skeletons when enrichment is done
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;


    const hasEnrichingItems = myQuotes.some(q =>
      (q.book && typeof q.book === 'object' && q.book.isEnriching) ||
      (q.author && typeof q.author === 'object' && q.author.isEnriching)
    );

    if (hasEnrichingItems && isFocused) {
      interval = setInterval(() => {
        refreshQuotes();
        // Optionnel: refreshAuthors/Books si on veut aussi mettre à jour les onglets stats
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [myQuotes, isFocused, refreshQuotes]);

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

  const authors = [...new Set(myQuotes.map(q => getAuthorName(q.author)))];
  const books = [...new Set(myQuotes.map(q => getBookTitle(q.book)))];
  const years = [...new Set(
    myQuotes
      .map(q => bookDescriptions[getBookTitle(q.book)]?.year)
      .filter((year): year is number => !!year)
  )].sort((a, b) => b - a);

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

  // Update displayed quotes when source or filters change
  useEffect(() => {
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
        const statusMatch = !filtersByType.status || (q.book && typeof q.book === 'object' && q.book.readingStatus && filtersByType.status.includes(q.book.readingStatus));
        return authorMatch && bookMatch && yearMatch && statusMatch;
      });
    }
    setQuotesToDisplay(filtered);

    // Sync temp filters
    setTempFilters([...activeFilters]);
  }, [myQuotes, activeFilters]);

  const handleDeleteQuote = (id: number) => {
    deleteQuote(id);
  };


  const toggleTempFilter = (type: 'author' | 'book' | 'year' | 'status', value: string | number) => {
    setTempFilters(currentFilters => {
      const existingFilterIndex = currentFilters.findIndex(f => f.type === type && f.value === value);
      if (existingFilterIndex > -1) {
        return currentFilters.filter((_, index) => index !== existingFilterIndex);
      } else {
        return [...currentFilters, { type, value }];
      }
    });
  };

  const applyFilters = () => {
    setActiveFilters([...tempFilters]);
    setFilterModalVisible(false);
    setExpandedSection(null);
  };

  const removeFilter = (filterToRemove: FilterType) => {
    setActiveFilters(currentFilters =>
      currentFilters.filter(
        f => !(f.type === filterToRemove.type && f.value === filterToRemove.value)
      )
    );
  };

  const resetFilters = () => {
    setActiveFilters([]);
    setTempFilters([]);
    if (filterModalVisible) {
      // Si la modale est ouverte, on la ferme
      setFilterModalVisible(false);
      setExpandedSection(null);
    }
  };

  const isEnriching = (item: any) => {
    if (item && typeof item === 'object') return !!item.isEnriching;
    return false;
  };

  const EnrichingSkeleton = ({ width = 120, height = 14 }: { width?: number, height?: number }) => {
    const pulseAnim = useSharedValue(0.4);

    useEffect(() => {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }),
          withTiming(0.4, { duration: 1000 })
        ),
        -1,
        true
      );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
      opacity: pulseAnim.value,
    }));

    return (
      <Animated.View
        style={[
          styles.skeleton,
          { width, height },
          pulseStyle
        ]}
      />
    );
  };

  // Quote Card without Swipe
  const QuoteCard = ({ quote }: { quote: Quote }) => {
    const isBookEnriching = isEnriching(quote.book);
    const isAuthorEnriching = isEnriching(quote.author);

    return (
      <View style={styles.cardWrapper}>
        <View style={styles.quoteCard}>
          {/* 3-Dots Menu Button - Top Left */}
          <TouchableOpacity
            style={styles.menuButton}
            onPress={(e) => {
              e.stopPropagation();
              setActionMenuQuote(quote);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              router.navigate({ pathname: '/quote-detail', params: { quoteId: quote.id } });
            }}
          >
            {/* Quote Icon (custom SVG) */}
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" style={styles.quoteIcon}>
              <Path
                d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                fill={colors.primary}
                opacity={0.12}
              />
            </Svg>

            {/* Quote Text */}
            <Text style={styles.quoteText}>{quote.text}</Text>

            {/* Book Info */}
            <View style={styles.bookInfo}>
              <View style={styles.bookInfoLeft}>
                {isBookEnriching ? (
                  <EnrichingSkeleton width={140} />
                ) : (
                  <Text style={styles.bookTitle}>{getBookTitle(quote.book)}</Text>
                )}

                {isAuthorEnriching ? (
                  <EnrichingSkeleton width={80} height={12} />
                ) : (
                  <Text style={styles.authorName} onPress={(e) => e.stopPropagation()}>
                    {getAuthorName(quote.author)}
                  </Text>
                )}
              </View>
              <Text style={styles.dateText}>{formatRelativeDate(quote.date)}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleLikeQuote(quote.id)}
              >
                <Heart
                  size={20}
                  color={quote.isLiked ? colors.primary : colors.textTertiary}
                  fill={quote.isLiked ? colors.primary : 'none'}
                />
                <Text style={[styles.actionText, quote.isLiked && styles.actionTextActive]}>
                  {quote.likesCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => {
                const handleShare = async () => {
                  try {
                    const authorName = getAuthorName(quote.author);
                    const message = `"${quote.text}"\n- ${authorName}\n(via Quotex)`;
                    await Share.share({
                      message,
                    });
                  } catch (error) {
                    console.error('Error sharing:', error);
                  }
                };
                handleShare();
              }}>
                <Share2 size={20} color={colors.textTertiary} />
                <Text style={styles.actionText}>Partager</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Action Menu Modal
  const QuoteActionModal = () => (
    <Modal
      visible={!!actionMenuQuote}
      transparent
      animationType="fade"
      onRequestClose={() => setActionMenuQuote(null)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setActionMenuQuote(null)}>
        <View style={styles.actionMenuContainer}>
          <View style={styles.actionMenuHeader}>
            <Text style={styles.actionMenuTitle}>Options</Text>
            <TouchableOpacity onPress={() => setActionMenuQuote(null)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={() => {
              if (actionMenuQuote) {
                setEditingQuote(actionMenuQuote);
                setShowManualQuoteModal(true);
              }
              setActionMenuQuote(null);
            }}
          >
            <Edit3 size={20} color={colors.text} style={{ marginRight: 12 }} />
            <Text style={styles.actionMenuText}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionMenuItem, { borderBottomWidth: 0 }]}
            onPress={() => {
              if (actionMenuQuote) {
                handleDeleteQuote(actionMenuQuote.id);
              }
              setActionMenuQuote(null);
            }}
          >
            <Trash2 size={20} color={colors.warning} style={{ marginRight: 12 }} />
            <Text style={[styles.actionMenuText, { color: colors.warning }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  const toggleSection = (section: 'author' | 'book' | 'year' | 'status' | null) => {
    setExpandedSection(current => (current === section ? null : section));
  };

  const booksData = useMemo(() => {
    const grouped = myQuotes.reduce<Record<string, { authors: Set<string>; quoteCount: number; bookObj?: Book }>>((acc, quote) => {
      const title = getBookTitle(quote.book);
      const author = getAuthorName(quote.author);
      if (!acc[title]) {
        acc[title] = { authors: new Set(), quoteCount: 0 };
      }
      acc[title].authors.add(author);
      acc[title].quoteCount += 1;
      if (typeof quote.book !== 'string') {
        acc[title].bookObj = quote.book;
      }
      return acc;
    }, {});

    // Ensure we include books who are explicitly saved by the user
    allBooks.forEach(book => {
      if (book.isSaved && !grouped[book.title]) {
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
  }, [myQuotes, allBooks, bookDescriptions]);

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
        // Upgrade to object if we found one
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
  // Add Menu Modal
  const AddQuoteMenu = () => (
    <Modal
      visible={showAddMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAddMenu(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setShowAddMenu(false)}>
        <View style={[styles.actionMenuContainer, { position: 'absolute', top: 60, right: 16, width: 220 }]}>
          {/* Scan Option */}
          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={() => {
              setShowAddMenu(false);
              router.navigate('/scan');
            }}
          >
            <Camera size={20} color={colors.text} style={{ marginRight: 12 }} />
            <Text style={styles.actionMenuText}>Scanner une citation</Text>
          </TouchableOpacity>

          {/* Manual Add Option */}
          <TouchableOpacity
            style={[styles.actionMenuItem, { borderBottomWidth: 0 }]}
            onPress={() => {
              setShowAddMenu(false);
              setEditingQuote(null);
              setShowManualQuoteModal(true);
            }}
          >
            <Edit3 size={20} color={colors.text} style={{ marginRight: 12 }} />
            <Text style={styles.actionMenuText}>Ajouter une citation</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

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
          <Text style={styles.statValue}>{new Set(myQuotes.map(q => q.book)).size}</Text>
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

      {/* Quotes Feed */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onScrollBeginDrag={() => {
          // Fermer le menu si besoin (optionnel)
        }}
      >
        {activeFilters.length > 0 && (
          <View style={styles.filterContainer}>
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
        )}
        {viewMode === 'books' && (
          <View style={{ marginBottom: 8 }}>
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
        )}
        {viewMode === 'books' ? (
          filteredBooksByStatus.length > 0 ? (
            filteredBooksByStatus.map(book => (
              <TouchableOpacity
                key={book.title}
                style={styles.bookCard}
                activeOpacity={0.85}
                onPress={() => navigateToBook(book.id ?? book.title, book.inventaireUri)}
              >
                <View style={styles.bookCardContent}>
                  {book.cover ? (
                    <Image source={{ uri: book.cover }} style={styles.bookCardCover} />
                  ) : (
                    <View style={styles.bookCardCoverPlaceholder} />
                  )}
                  <View style={styles.bookCardInfo}>
                    <View style={styles.bookCardHeader}>
                      <Text style={styles.bookCardTitle}>{book.title}</Text>
                      {typeof book.year === 'number' && <Text style={styles.bookCardYear}>{book.year}</Text>}
                    </View>
                    <Text style={styles.bookCardAuthor}>{book.authors.length > 0 ? book.authors.join(', ') : 'Auteur inconnu'}</Text>
                    {book.description && <Text numberOfLines={3} style={styles.bookCardDescription}>{book.description}</Text>}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={styles.bookCardCount}>{book.quoteCount} citation{book.quoteCount > 1 ? 's' : ''}</Text>
                      {book.readingStatus && (
                        <View style={[styles.statusBadge, {
                          backgroundColor: getStatusColor(book.readingStatus) + '15',
                          borderColor: getStatusColor(book.readingStatus) + '40',
                          marginTop: 0
                        }]}>
                          <Text style={[styles.statusText, { color: getStatusColor(book.readingStatus) }]}>
                            {getStatusLabel(book.readingStatus)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyStateText}>Aucun livre à afficher avec ces filtres.</Text>
          )
        ) : viewMode === 'authors' ? (
          authorsData.length > 0 ? (
            authorsData.map(author => (
              <TouchableOpacity
                key={author.name}
                style={styles.bookCard}
                activeOpacity={0.85}
                onPress={() => navigateToAuthor(author.name, author.inventaireUri)}
              >
                <View style={[styles.bookCardContent, { alignItems: 'center' }]}>
                  {author.image ? (
                    <Image source={{ uri: author.image }} style={styles.authorAvatar} />
                  ) : (
                    <View style={styles.authorAvatarPlaceholder}>
                      <Text style={styles.authorAvatarText}>{author.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookCardTitle, { marginBottom: 4 }]}>{author.name}</Text>
                    <Text style={styles.bookCardCount}>{author.quoteCount} citation{author.quoteCount > 1 ? 's' : ''}</Text>
                  </View>
                  <ChevronDown size={20} color={colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyStateText}>Aucun auteur à afficher avec ces filtres.</Text>
          )
        ) : viewMode === 'themes' ? (
          themes.length > 0 ? (
            themes.map(theme => (
              <View key={theme.theme} style={styles.bookCard}>
                <TouchableOpacity
                  style={[styles.bookCardContent, { alignItems: 'center' }]}
                  activeOpacity={0.85}
                  onPress={() => router.navigate({ pathname: '/theme-detail', params: { themeName: theme.theme } })}
                >
                  <View style={styles.themeIconContainer}>
                    <Text style={styles.themeIconText}>{theme.theme[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.themeTitle}>{theme.theme}</Text>
                    <Text style={styles.themeSubText}>{theme.books.length} livre{theme.books.length > 1 ? 's' : ''} • {theme.quoteCount} citation{theme.quoteCount > 1 ? 's' : ''}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyStateText}>Aucun thème à afficher avec ces filtres.</Text>
          )
        ) : (
          quotesToDisplay.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} />
          ))
        )}
      </ScrollView>
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => { setFilterModalVisible(false); setExpandedSection(null); }}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => { setFilterModalVisible(false); setExpandedSection(null); }}>
          <Pressable style={styles.modalView}>
            <Text style={styles.modalTitle}>Filtrer par</Text>
            <ScrollView style={{ maxHeight: '80%' }}>
              {/* Section Auteur */}
              <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('author')}>
                <Text style={styles.filterSectionTitle}>Auteur</Text>
                <View style={{ transform: [{ rotate: expandedSection === 'author' ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              {expandedSection === 'author' && authors.map(author => (
                <TouchableOpacity key={author} style={styles.filterOption} onPress={() => toggleTempFilter('author', author)}>
                  <Text style={[styles.filterOptionText, tempFilters.some(f => f.type === 'author' && f.value === author) && styles.filterOptionTextSelected]}>{author}</Text>
                </TouchableOpacity>
              ))}

              {/* Section Livre */}
              <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('book')}>
                <Text style={styles.filterSectionTitle}>Livre</Text>
                <View style={{ transform: [{ rotate: expandedSection === 'book' ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              {expandedSection === 'book' && books.map(book => (
                <TouchableOpacity key={book} style={styles.filterOption} onPress={() => toggleTempFilter('book', book)}>
                  <Text style={[styles.filterOptionText, tempFilters.some(f => f.type === 'book' && f.value === book) && styles.filterOptionTextSelected]}>{book}</Text>
                </TouchableOpacity>
              ))}

              {/* Section Statut */}
              <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('status')}>
                <Text style={styles.filterSectionTitle}>Statut</Text>
                <View style={{ transform: [{ rotate: expandedSection === 'status' ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              {expandedSection === 'status' && STATUS_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} style={styles.filterOption} onPress={() => toggleTempFilter('status', opt.value)}>
                  <Text style={[styles.filterOptionText, tempFilters.some(f => f.type === 'status' && f.value === opt.value) && styles.filterOptionTextSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}

              {/* Section Année */}
              <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('year')}>
                <Text style={styles.filterSectionTitle}>Année</Text>
                <View style={{ transform: [{ rotate: expandedSection === 'year' ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              {expandedSection === 'year' && years.map(year => (
                <TouchableOpacity key={year} style={styles.filterOption} onPress={() => toggleTempFilter('year', year)}>
                  <Text style={[styles.filterOptionText, tempFilters.some(f => f.type === 'year' && f.value === year) && styles.filterOptionTextSelected]}>{year}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              {tempFilters.length > 0 && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => setTempFilters([])}
                >
                  <Text style={styles.resetButtonText}>Réinitialiser</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyButtonText}>Appliquer</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>


      <ScanPreviewModal
        visible={showManualQuoteModal}
        onClose={() => {
          setShowManualQuoteModal(false);
          setEditingQuote(null);
        }}
        onConfirm={async (text, book, author) => {
          if (editingQuote) {
            await updateQuote(editingQuote.id, { text, book: book || editingQuote.book, author: author || editingQuote.author });
          } else {
            await addQuote(text, book, author);
          }
          setShowManualQuoteModal(false);
          setEditingQuote(null);
          refreshQuotes();
        }}
        scannedText={editingQuote ? editingQuote.text : ""}
        initialBook={editingQuote ? getBookTitle(editingQuote.book) : ""}
        initialAuthor={editingQuote ? getAuthorName(editingQuote.author) : ""}
      />
      <QuoteActionModal />
      <AddQuoteMenu />
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
  menuButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderBottomColor: colors.surfaceHighlight, // approximating rgba(255,255,255,0.05)
  },
  actionMenuText: {
    fontSize: 16,
    color: colors.text,
  },
  cardContainer: {
    zIndex: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden' // Added from inline style
  },

  quoteIcon: {
    // fontSize: 32, // Svg style doesn't use fontSize usually, but it was there
    color: 'rgba(32, 184, 205, 0.2)', // Hardcoded opacity for icon
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.text,
    marginBottom: 16,
    fontFamily: 'Times New Roman',
    fontStyle: 'italic',
    fontWeight: '100',
  },
  bookInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHighlight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookInfoLeft: {
    flex: 1,
    marginRight: 12,
  },
  bookTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  authorName: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  actionText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actionTextActive: {
    color: colors.primary,
  },
  iconFilled: {
    // Pour simuler le fill, vous devrez utiliser une icône différente
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
  skeleton: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 4,
    marginVertical: 4,
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
  deleteActionText: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '600',
  },
  cardWrapper: {
    width: '100%',
  },
  bookCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    overflow: 'hidden',
  },
  bookCardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  bookCardCover: {
    width: 60,
    height: 90,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: colors.surfaceHighlight,
  },
  bookCardCoverPlaceholder: {
    width: 60,
    height: 90,
    borderRadius: 4,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHighlight,
  },
  bookCardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  bookCardTitle: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  bookCardYear: {
    fontSize: 12,
    color: colors.textTertiary,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bookCardAuthor: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 6,
  },
  bookCardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  bookCardCount: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
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
  authorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: colors.surfaceHighlight,
  },
  authorAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  themeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  themeIconText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 24,
  },
  themeTitle: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  themeSubText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});