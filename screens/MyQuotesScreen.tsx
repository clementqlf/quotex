import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView, 
  Modal,
  Pressable,
} from 'react-native'; 
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { BookOpen, Search, Filter, Heart, Share2, X, ChevronDown } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg'; 
import { localQuotesDB, bookDescriptions } from '../data/staticData';
import { useTabIndex } from '../TabNavigator';
 
type FilterType = { type: 'author' | 'book' | 'year'; value: string | number };
export default function MyQuotesScreen() {
  const navigation = useNavigation<any>();
  const [quotes, setQuotes] = useState(localQuotesDB);
  const { setTabIndex } = useTabIndex();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      setTabIndex(0);
    }
  }, [isFocused]);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [tempFilters, setTempFilters] = useState<FilterType[]>([]);
  const [expandedSection, setExpandedSection] = useState<'author' | 'book' | 'year' | null>(null);

  const authors = [...new Set(localQuotesDB.map(q => q.author))];
  const books = [...new Set(localQuotesDB.map(q => q.book))];
  const years = [...new Set(
    localQuotesDB
        .map(q => bookDescriptions[q.book]?.year)
        .filter((year): year is number => !!year)
  )].sort((a, b) => b - a);

  // Rafraîchit les données lorsque l'écran est focus (après un scan par exemple)
  useEffect(() => {
    if (isFocused) {
      let quotesToDisplay = [...localQuotesDB];
      if (activeFilters.length > 0) {
        const filtersByType = activeFilters.reduce((acc, filter) => { 
          if (!acc[filter.type]) {
            acc[filter.type] = [];
          }
          acc[filter.type].push(filter.value);
          return acc;
        }, {} as Record<'author' | 'book' | 'year', (string | number)[]>);

        quotesToDisplay = quotesToDisplay.filter(q => {
          const authorMatch = !filtersByType.author || filtersByType.author.includes(q.author);
          const bookMatch = !filtersByType.book || filtersByType.book.includes(q.book);
          const yearMatch = !filtersByType.year || (bookDescriptions[q.book] && filtersByType.year.includes(bookDescriptions[q.book].year));
          return authorMatch && bookMatch && yearMatch;
        });
      }
      setQuotes(quotesToDisplay);
    }
    // On met à jour les filtres temporaires quand les filtres actifs changent
    setTempFilters([...activeFilters]);
  }, [isFocused, activeFilters]);

  const toggleLike = (id: number) => {
    const newQuotes = quotes.map(q => {
      if (q.id === id) {
        const updatedQuote = { ...q, isLiked: !q.isLiked, likes: q.isLiked ? q.likes - 1 : q.likes + 1 };
        // Mettre à jour la "base de données" pour la persistance de la démo
        const dbIndex = localQuotesDB.findIndex(dbq => dbq.id === id);
        if (dbIndex > -1) localQuotesDB[dbIndex] = updatedQuote;
        return updatedQuote;
      }
      return q;
    });
    setQuotes(newQuotes);
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

  const toggleSection = (section: 'author' | 'book' | 'year' | null) => {
    setExpandedSection(current => (current === section ? null : section));
  };
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
          <TouchableOpacity style={styles.headerButton}>
            <Search size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => { setTempFilters([...activeFilters]); setFilterModalVisible(true); }}>
            <Filter size={20} color={activeFilters.length > 0 ? "#20B8CD" : "#9CA3AF"} />
          </TouchableOpacity>
        </View>
      </View>

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
          <Text style={styles.statValue}>{new Set(quotes.map(q => q.book)).size}</Text>
          <Text style={styles.statLabel}>Livres</Text>
        </View>
      </View>

      {/* Quotes Feed */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
        {quotes.map((quote) => (
          <TouchableOpacity
            key={quote.id}
            style={styles.quoteCard}
            onPress={() => {
              // On trouve la dernière version de la citation pour la passer au modal
              const currentQuote = quotes.find(q => q.id === quote.id) || quote;
              navigation.navigate('QuoteDetail', { quote: currentQuote, onToggleLike: () => toggleLike(quote.id) });
            }}
            activeOpacity={0.7}
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
                <Text style={styles.bookTitle}>{quote.book}</Text>
                {/* Le nom de l'auteur n'est plus cliquable ici */}
                <Text style={styles.authorName} onPress={(e) => e.stopPropagation()}>
                  {quote.author}
                </Text>
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
          </TouchableOpacity>
        ))}
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
                <ChevronDown size={20} color="#9CA3AF" style={{ transform: [{ rotate: expandedSection === 'author' ? '180deg' : '0deg' }] }} />
              </TouchableOpacity>
              {expandedSection === 'author' && authors.map(author => (
                  <TouchableOpacity key={author} style={styles.filterOption} onPress={() => toggleTempFilter('author', author)}>
                    <Text style={[styles.filterOptionText, tempFilters.some(f => f.type === 'author' && f.value === author) && styles.filterOptionTextSelected]}>{author}</Text>
                  </TouchableOpacity>
              ))}

              {/* Section Livre */}
              <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('book')}>
                <Text style={styles.filterSectionTitle}>Livre</Text>
                <ChevronDown size={20} color="#9CA3AF" style={{ transform: [{ rotate: expandedSection === 'book' ? '180deg' : '0deg' }] }} />
              </TouchableOpacity>
              {expandedSection === 'book' && books.map(book => (
                  <TouchableOpacity key={book} style={styles.filterOption} onPress={() => toggleTempFilter('book', book)}>
                    <Text style={[styles.filterOptionText, tempFilters.some(f => f.type === 'book' && f.value === book) && styles.filterOptionTextSelected]}>{book}</Text>
                  </TouchableOpacity>
              ))}

              {/* Section Année */}
              <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('year')}>
                <Text style={styles.filterSectionTitle}>Année</Text>
                <ChevronDown size={20} color="#9CA3AF" style={{ transform: [{ rotate: expandedSection === 'year' ? '180deg' : '0deg' }] }} />
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
    </SafeAreaView>
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