import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { BookOpen, Search, Filter, Heart, Share2, Quote, QuoteIcon} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

const myQuotes = [
  {
    id: 1,
    text: "The only way to do great work is to love what you do.",
    book: "Steve Jobs",
    author: "Walter Isaacson",
    date: "Il y a 2h",
    likes: 12,
    isLiked: true,
  },
  {
    id: 2,
    text: "In the middle of difficulty lies opportunity.",
    book: "Einstein: His Life and Universe",
    author: "Walter Isaacson",
    date: "Il y a 5h",
    likes: 8,
    isLiked: false,
  },
  {
    id: 3,
    text: "It is our choices that show what we truly are, far more than our abilities.",
    book: "Harry Potter and the Chamber of Secrets",
    author: "J.K. Rowling",
    date: "Hier",
    likes: 24,
    isLiked: true,
  },
];

export default function MyQuotesScreen() {
  const [quotes, setQuotes] = useState(myQuotes);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [likedOnly, setLikedOnly] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<number | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filterAuthor, setFilterAuthor] = useState<string | null>(null);
  const [filterBook, setFilterBook] = useState<string | null>(null);
  const [filterPublicationYear, setFilterPublicationYear] = useState<number | null>(null);
  const [filterScanYear, setFilterScanYear] = useState<number | null>(null);

  const toggleLike = (id: number) => {
    setQuotes(quotes.map(q =>
      q.id === id
        ? { ...q, isLiked: !q.isLiked, likes: q.isLiked ? q.likes - 1 : q.likes + 1 }
        : q
    ));
  };

  // Get unique values for filters
  const uniqueAuthors = useMemo(() => Array.from(new Set(myQuotes.map(q => q.author))).sort(), []);
  const uniqueBooks = useMemo(() => Array.from(new Set(myQuotes.map(q => q.book))).sort(), []);
  const uniquePublicationYears = useMemo(() => Array.from(new Set(myQuotes.map(q => (q as any).publicationYear).filter(Boolean))).sort((a: number, b: number) => b - a), []);
  const uniqueScanYears = useMemo(() => Array.from(new Set(myQuotes.map(q => (q as any).scanYear).filter(Boolean))).sort((a: number, b: number) => b - a), []);

  // Filter quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      if (likedOnly && !q.isLiked) return false;
      if (filterAuthor && q.author !== filterAuthor) return false;
      if (filterBook && q.book !== filterBook) return false;
      if (filterPublicationYear && (q as any).publicationYear !== filterPublicationYear) return false;
      if (filterScanYear && (q as any).scanYear !== filterScanYear) return false;
      if (!searchQuery) return true;
      const ql = searchQuery.toLowerCase();
      return (
        q.text.toLowerCase().includes(ql) ||
        q.book.toLowerCase().includes(ql) ||
        q.author.toLowerCase().includes(ql)
      );
    });
  }, [quotes, likedOnly, filterAuthor, filterBook, filterPublicationYear, filterScanYear, searchQuery]);

  const activeFiltersCount = [filterAuthor, filterBook, filterPublicationYear, filterScanYear].filter(Boolean).length;

  const resetFilters = () => {
    setFilterAuthor(null);
    setFilterBook(null);
    setFilterPublicationYear(null);
    setFilterScanYear(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <BookOpen size={16} color="#20B8CD" />
          </View>
          <Text style={styles.headerTitle}>Mes Citations</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setSearchVisible(v => !v)}>
            <Search size={20} color={searchVisible ? '#20B8CD' : '#9CA3AF'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowFilters(v => !v)}>
            <Filter size={20} color={(showFilters || activeFiltersCount > 0 || likedOnly) ? '#20B8CD' : '#9CA3AF'} />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar (toggle) */}
      {searchVisible && (
        <View style={styles.searchBarWrap}>
          <TextInput
            placeholder="Rechercher citations, livre, auteur..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
            clearButtonMode="while-editing"
          />
        </View>
      )}

      {/* Filters panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Auteur</Text>
            <View style={styles.chipsContainer}>
              <TouchableOpacity
                style={[styles.chip, !filterAuthor && styles.chipActive]}
                onPress={() => setFilterAuthor(null)}
              >
                <Text style={[styles.chipText, !filterAuthor && styles.chipTextActive]}>Tous</Text>
              </TouchableOpacity>
              {uniqueAuthors.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.chip, filterAuthor === a && styles.chipActive]}
                  onPress={() => setFilterAuthor(filterAuthor === a ? null : a)}
                >
                  <Text style={[styles.chipText, filterAuthor === a && styles.chipTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Livre</Text>
            <View style={styles.chipsContainer}>
              <TouchableOpacity
                style={[styles.chip, !filterBook && styles.chipActive]}
                onPress={() => setFilterBook(null)}
              >
                <Text style={[styles.chipText, !filterBook && styles.chipTextActive]}>Tous</Text>
              </TouchableOpacity>
              {uniqueBooks.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.chip, filterBook === b && styles.chipActive]}
                  onPress={() => setFilterBook(filterBook === b ? null : b)}
                >
                  <Text style={[styles.chipText, filterBook === b && styles.chipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Année publication</Text>
            <View style={styles.chipsContainer}>
              <TouchableOpacity
                style={[styles.chip, !filterPublicationYear && styles.chipActive]}
                onPress={() => setFilterPublicationYear(null)}
              >
                <Text style={[styles.chipText, !filterPublicationYear && styles.chipTextActive]}>Tous</Text>
              </TouchableOpacity>
              {uniquePublicationYears.map(y => (
                <TouchableOpacity
                  key={String(y)}
                  style={[styles.chip, filterPublicationYear === y && styles.chipActive]}
                  onPress={() => setFilterPublicationYear(filterPublicationYear === y ? null : Number(y))}
                >
                  <Text style={[styles.chipText, filterPublicationYear === y && styles.chipTextActive]}>{String(y)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Année scan</Text>
            <View style={styles.chipsContainer}>
              <TouchableOpacity
                style={[styles.chip, !filterScanYear && styles.chipActive]}
                onPress={() => setFilterScanYear(null)}
              >
                <Text style={[styles.chipText, !filterScanYear && styles.chipTextActive]}>Tous</Text>
              </TouchableOpacity>
              {uniqueScanYears.map(y => (
                <TouchableOpacity
                  key={String(y)}
                  style={[styles.chip, filterScanYear === y && styles.chipActive]}
                  onPress={() => setFilterScanYear(filterScanYear === y ? null : Number(y))}
                >
                  <Text style={[styles.chipText, filterScanYear === y && styles.chipTextActive]}>{String(y)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
              <Text style={styles.resetButtonText}>Réinitialiser</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowFilters(false)}>
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{quotes.length}</Text>
          <Text style={styles.statLabel}>Citations</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{quotes.reduce((acc, q) => acc + q.likes, 0)}</Text>
          <Text style={styles.statLabel}>J'aime</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>8</Text>
          <Text style={styles.statLabel}>Livres</Text>
        </View>
      </View>

      {/* Quotes Feed */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredQuotes.map((quote) => (
          <View key={quote.id} style={styles.quoteCard}>
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
                <Text style={styles.bookTitle}>{quote.book}</Text>
                <Text style={styles.authorName}>{quote.author}</Text>
              </View>
              <Text style={styles.dateText}>{quote.date}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleLike(quote.id)}
              >
                <Heart
                  size={20}
                  color={quote.isLiked ? '#20B8CD' : '#6B7280'}
                  fill={quote.isLiked ? '#20B8CD' : 'none'}
                />
                <Text style={[styles.actionText, quote.isLiked && styles.actionTextActive]}>
                  {quote.likes}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Share2 size={20} color="#6B7280" />
                <Text style={styles.actionText}>Partager</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
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
    paddingBottom: 80,
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
    fontSize: 16,
    lineHeight: 24,
    color: '#E5E7EB',
    marginBottom: 16,
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
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#20B8CD',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#0F0F0F',
    fontSize: 10,
    fontWeight: '600',
  },
  filterPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F0F0F',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#052024',
    borderColor: '#20B8CD',
  },
  chipText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#20B8CD',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  resetButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginRight: 8,
  },
  resetButtonText: {
    color: '#9CA3AF',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#20B8CD',
  },
  closeButtonText: {
    color: '#0F0F0F',
    fontWeight: '600',
  },
});