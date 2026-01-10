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
  Animated,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { BookOpen, Search, Filter, Heart, Share2, X, ChevronDown, Trash2, Edit3, Plus, MoreVertical, Camera } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { bookDescriptions } from '../data/staticData';
import ScanPreviewModal from '../components/ScanPreviewModal';
import { useTabIndex } from '../TabNavigator';
import { useData } from '../src/contexts/DataProvider';
import { Quote } from '../types';
import { getBookTitle, getAuthorName } from '../src/utils/dataHelpers';
import { formatRelativeDate } from '../src/utils/dateUtils';

type FilterType = { type: 'author' | 'book' | 'year'; value: string | number };
const EDGE_SWIPE_ZONE = 28;
const SWIPE_ACTIVATION_THRESHOLD = 60;

export default function MyQuotesScreen() {
  const navigation = useNavigation<any>();
  const { quotes: allQuotes, toggleLikeQuote, deleteQuote, refreshQuotes, addQuote, updateQuote } = useData();

  // Filter for "My Quotes" (current user is ID 1) or legacy local quotes
  const myQuotes = useMemo(() => allQuotes.filter(q => q.user?.id == 1 || !q.user), [allQuotes]);

  const [quotesToDisplay, setQuotesToDisplay] = useState(myQuotes);

  const { setTabIndex } = useTabIndex();
  const isFocused = useIsFocused();
  const scrollViewRef = useRef<ScrollView>(null);

  // Edit State
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [actionMenuQuote, setActionMenuQuote] = useState<Quote | null>(null);

  useEffect(() => {
    if (isFocused) {
      setTabIndex(0);
      refreshQuotes();
    }
  }, [isFocused]);

  const [showManualQuoteModal, setShowManualQuoteModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [tempFilters, setTempFilters] = useState<FilterType[]>([]);
  const [expandedSection, setExpandedSection] = useState<'author' | 'book' | 'year' | null>(null);
  const [viewMode, setViewMode] = useState<'quotes' | 'books' | 'themes' | 'authors'>('quotes');

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
      }, {} as Record<'author' | 'book' | 'year', (string | number)[]>);

      filtered = filtered.filter(q => {
        const authorMatch = !filtersByType.author || filtersByType.author.includes(getAuthorName(q.author));
        const bookMatch = !filtersByType.book || filtersByType.book.includes(getBookTitle(q.book));
        const yearMatch = !filtersByType.year || (bookDescriptions[getBookTitle(q.book)] && filtersByType.year.includes(bookDescriptions[getBookTitle(q.book)].year));
        return authorMatch && bookMatch && yearMatch;
      });
    }
    setQuotesToDisplay(filtered);

    // Sync temp filters
    setTempFilters([...activeFilters]);
  }, [myQuotes, activeFilters]);

  const handleDeleteQuote = (id: number) => {
    deleteQuote(id);
  };


  const toggleTempFilter = (type: 'author' | 'book' | 'year', value: string | number) => {
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


  // Quote Card without Swipe
  const QuoteCard = ({ quote }: { quote: Quote }) => {
    return (
      <View style={styles.cardWrapper}>
        <View style={[styles.quoteCard, { backgroundColor: '#1A1A1A', borderRadius: 16, overflow: 'hidden' }]}>
          {/* 3-Dots Menu Button - Top Left */}
          <TouchableOpacity
            style={styles.menuButton}
            onPress={(e) => {
              e.stopPropagation();
              setActionMenuQuote(quote);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              const currentQuote = quotesToDisplay.find(q => q.id === quote.id) || quote;
              navigation.navigate('QuoteDetail', { quote: currentQuote });
            }}
          >
            {/* Quote Icon (custom SVG) */}
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" style={styles.quoteIcon}>
              <Path
                d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                fill="#20B8CD"
                opacity={0.12}
              />
            </Svg>

            {/* Quote Text */}
            <Text style={styles.quoteText}>{quote.text}</Text>

            {/* Book Info */}
            <View style={styles.bookInfo}>
              <View style={styles.bookInfoLeft}>
                <Text style={styles.bookTitle}>{getBookTitle(quote.book)}</Text>
                {/* Le nom de l'auteur n'est plus cliquable ici */}
                <Text style={styles.authorName} onPress={(e) => e.stopPropagation()}>
                  {getAuthorName(quote.author)}
                </Text>
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
                  color={quote.isLiked ? '#20B8CD' : '#6B7280'}
                  fill={quote.isLiked ? '#20B8CD' : 'none'}
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
                <Share2 size={20} color="#6B7280" />
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
              <X size={20} color="#9CA3AF" />
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
            <Edit3 size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
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
            <Trash2 size={20} color="#EF4444" style={{ marginRight: 12 }} />
            <Text style={[styles.actionMenuText, { color: '#EF4444' }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  const toggleSection = (section: 'author' | 'book' | 'year' | null) => {
    setExpandedSection(current => (current === section ? null : section));
  };

  const booksData = useMemo(() => {
    const grouped = myQuotes.reduce<Record<string, { authors: Set<string>; quoteCount: number }>>((acc, quote) => {
      const title = getBookTitle(quote.book);
      const author = getAuthorName(quote.author);
      if (!acc[title]) {
        acc[title] = { authors: new Set(), quoteCount: 0 };
      }
      acc[title].authors.add(author);
      acc[title].quoteCount += 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([bookTitle, data]) => {
        const meta = bookDescriptions[bookTitle];
        return {
          title: bookTitle,
          authors: Array.from(data.authors),
          quoteCount: data.quoteCount,
          year: meta?.year,
          description: meta?.description,
          cover: meta?.cover,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [myQuotes]);

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

    return Object.values(grouped)
      .map((data) => ({
        name: getAuthorName(data.author),
        image: typeof data.author !== 'string' ? data.author?.image : null,
        quoteCount: data.quoteCount,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [myQuotes]);
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
              navigation.navigate('Scan');
            }}
          >
            <Camera size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
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
            <Edit3 size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
            <Text style={styles.actionMenuText}>Ajouter une citation</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <BookOpen size={16} color="#20B8CD" />
          </View>
          <Text style={styles.headerTitle}>Mes Citations</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowAddMenu(true)}>
            <Plus size={20} color="#20B8CD" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Search')}>
            <Search size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => { setTempFilters([...activeFilters]); setFilterModalVisible(true); }}>
            <Filter size={20} color={activeFilters.length > 0 ? "#20B8CD" : "#9CA3AF"} />
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
        onScrollBeginDrag={() => {
          // Fermer le menu si besoin (optionnel)
        }}
      >
        {activeFilters.length > 0 && (
          <View style={styles.filterContainer}>
            {activeFilters.map((filter, index) => (
              <TouchableOpacity key={`${filter.type}-${filter.value}-${index}`} style={styles.filterBadge} onPress={() => removeFilter(filter)}>
                <Text style={styles.filterBadgeText}>{filter.type === 'author' ? 'Auteur' : filter.type === 'book' ? 'Livre' : 'Année'}: {filter.value}</Text>
                <X size={12} color="#20B8CD" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={resetFilters} style={styles.clearFilterButton}><Text style={styles.clearFilterButtonText}>Tout effacer</Text></TouchableOpacity>
          </View>
        )}
        {viewMode === 'books' ? (
          booksData.length > 0 ? (
            booksData.map(book => (
              <TouchableOpacity
                key={book.title}
                style={styles.bookCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('BookDetail', { bookTitle: book.title })}
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
                    <Text style={styles.bookCardCount}>{book.quoteCount} citation{book.quoteCount > 1 ? 's' : ''} sauvegardée{book.quoteCount > 1 ? 's' : ''}</Text>
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
                onPress={() => navigation.navigate('AuthorDetail', { authorName: author.name })}
              >
                <View style={[styles.bookCardContent, { alignItems: 'center' }]}>
                  {author.image ? (
                    <Image source={{ uri: author.image }} style={{ width: 60, height: 60, borderRadius: 30, marginRight: 16, backgroundColor: '#2A2A2A' }} />
                  ) : (
                    <View style={{ width: 60, height: 60, borderRadius: 30, marginRight: 16, backgroundColor: '#20B8CD22', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#20B8CD' }}>{author.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookCardTitle, { marginBottom: 4 }]}>{author.name}</Text>
                    <Text style={styles.bookCardCount}>{author.quoteCount} citation{author.quoteCount > 1 ? 's' : ''}</Text>
                  </View>
                  <ChevronDown size={20} color="#6B7280" style={{ transform: [{ rotate: '-90deg' }] }} />
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
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ThemeDetail', { themeName: theme.theme })}
                >
                  <View style={{
                    width: 48, height: 48, borderRadius: 24, backgroundColor: '#20B8CD22',
                    justifyContent: 'center', alignItems: 'center', marginRight: 16,
                  }}>
                    <Text style={{ color: '#20B8CD', fontWeight: 'bold', fontSize: 18 }}>{theme.theme[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>{theme.theme}</Text>
                    <Text style={{ color: '#6B7280', fontSize: 13 }}>{theme.books.length} livre{theme.books.length > 1 ? 's' : ''} • {theme.quoteCount} citation{theme.quoteCount > 1 ? 's' : ''}</Text>
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
                  <ChevronDown size={20} color="#9CA3AF" />
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
                  <ChevronDown size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
              {expandedSection === 'book' && books.map(book => (
                <TouchableOpacity key={book} style={styles.filterOption} onPress={() => toggleTempFilter('book', book)}>
                  <Text style={[styles.filterOptionText, tempFilters.some(f => f.type === 'book' && f.value === book) && styles.filterOptionTextSelected]}>{book}</Text>
                </TouchableOpacity>
              ))}

              {/* Section Année */}
              <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('year')}>
                <Text style={styles.filterSectionTitle}>Année</Text>
                <View style={{ transform: [{ rotate: expandedSection === 'year' ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={20} color="#9CA3AF" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(32, 184, 205, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statItemActive: {
    borderColor: '#20B8CD',
    backgroundColor: 'rgba(32, 184, 205, 0.08)',
  },
  statValue: {
    fontSize: 18,
    color: '#20B8CD',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
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
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  actionMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionMenuTitle: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: 'bold',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  actionMenuText: {
    fontSize: 16,
    color: '#FFF',
  },
  cardContainer: {
    zIndex: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  quoteCard: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },

  quoteIcon: {
    fontSize: 32,
    color: 'rgba(32, 184, 205, 0.2)',
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#E5E7EB',
    marginBottom: 16,
    fontFamily: 'Times New Roman',
    fontStyle: 'italic',
    fontWeight: '100',
  },
  bookInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  bookInfoLeft: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 14,
    color: '#20B8CD',
    marginBottom: 4,
  },
  authorName: {
    fontSize: 12,
    color: '#6B7280',
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  actionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionTextActive: {
    color: '#20B8CD',
  },
  iconFilled: {
    // Pour simuler le fill, vous devrez utiliser une icône différente
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 25,
    width: '80%',
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#20B8CD',
  },
  filterOption: {
    paddingVertical: 10,
    paddingLeft: 10,
  },
  filterOptionText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  filterOptionTextSelected: {
    color: '#20B8CD',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 10,
  },
  resetButtonText: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#20B8CD',
    borderRadius: 10,
    padding: 10,
  },
  applyButtonText: {
    color: '#0F0F0F',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(32, 184, 205, 0.1)',
    borderColor: 'rgba(32, 184, 205, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  filterBadgeText: {
    color: '#20B8CD',
    fontSize: 12,
  },
  deleteActionText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '600',
  },
  cardWrapper: {
    marginBottom: 16,
    overflow: 'hidden',
    borderRadius: 16,
  },
  bookCard: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  bookCardContent: {
    flexDirection: 'row',
    gap: 16,
  },
  bookCardCover: {
    width: 72,
    height: 108,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#0F0F0F',
  },
  bookCardCoverPlaceholder: {
    width: 72,
    height: 108,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#131313',
  },
  bookCardInfo: {
    flex: 1,
  },
  bookCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  bookCardTitle: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bookCardYear: {
    fontSize: 12,
    color: '#6B7280',
  },
  bookCardAuthor: {
    fontSize: 14,
    color: '#20B8CD',
    marginBottom: 8,
  },
  bookCardDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 20,
    marginBottom: 12,
  },
  bookCardCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyStateText: {
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 40,
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  clearFilterButtonText: {
    color: '#6B7280',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});