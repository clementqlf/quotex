import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  Pressable,
  Image,
  PanResponder,
  Animated,
} from 'react-native'; 
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { BookOpen, Search, Filter, Heart, Share2, X, ChevronDown, Trash2, Edit3 } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg'; 
import { localQuotesDB, bookDescriptions } from '../data/staticData';
import { useTabIndex } from '../TabNavigator';
 
type FilterType = { type: 'author' | 'book' | 'year'; value: string | number };
const EDGE_SWIPE_ZONE = 28;
const SWIPE_ACTIVATION_THRESHOLD = 60;
export default function MyQuotesScreen() {
  const navigation = useNavigation<any>();
  const [quotes, setQuotes] = useState(localQuotesDB);
  const { setTabIndex } = useTabIndex();
  const isFocused = useIsFocused();
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isFocused) {
      setTabIndex(0);
    }
  }, [isFocused]);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterType[]>([]);
  const [tempFilters, setTempFilters] = useState<FilterType[]>([]);
  const [expandedSection, setExpandedSection] = useState<'author' | 'book' | 'year' | null>(null);
  const [viewMode, setViewMode] = useState<'quotes' | 'books' | 'themes'>('quotes');

  const authors = [...new Set(localQuotesDB.map(q => q.author))];
  const books = [...new Set(localQuotesDB.map(q => q.book))];
  const years = [...new Set(
    localQuotesDB
        .map(q => bookDescriptions[q.book]?.year)
        .filter((year): year is number => !!year)
  )].sort((a, b) => b - a);

  // Liste des thèmes (notion abordée)
  const themes = useMemo(() => {
    // Regroupe les citations par thème (champ theme de la citation)
    const grouped: Record<string, { books: Set<string>; quoteCount: number }> = {};
    for (const q of quotes) {
      const theme = q.theme || 'Thème non renseigné';
      if (!grouped[theme]) grouped[theme] = { books: new Set(), quoteCount: 0 };
      grouped[theme].books.add(q.book);
      grouped[theme].quoteCount += 1;
    }
    return Object.entries(grouped)
      .map(([theme, data]) => ({
        theme,
        books: Array.from(data.books),
        quoteCount: data.quoteCount,
      }))
      .sort((a, b) => a.theme.localeCompare(b.theme));
  }, [quotes]);

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

  const handleDeleteQuote = (id: number) => {
    setQuotes(currentQuotes => currentQuotes.filter(q => q.id !== id));
    const dbIndex = localQuotesDB.findIndex(dbq => dbq.id === id);
    if (dbIndex > -1) {
      localQuotesDB.splice(dbIndex, 1);
    }
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


  // Gestion d'une seule carte ouverte à la fois (au niveau du parent)
  const [openCardId, setOpenCardId] = useState<number | null>(null);

  // Composant de carte de citation avec support du swipe et animation
  const QuoteCardSwipeable = ({ quote }: { quote: typeof localQuotesDB[0] }) => {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartX = useRef(0);
    const currentDragX = useRef(0);
    const lastUpdateX = useRef(0);
    const dragStartTime = useRef(0);
    const translateX = useRef(new Animated.Value(0)).current;
    const verticalScrollDisabled = useRef(false);
    const isOpen = openCardId === quote.id;

    // Empêche le scroll vertical du parent pendant le swipe
    const disableParentScroll = (disable: boolean) => {
      if (scrollViewRef.current && scrollViewRef.current.setNativeProps) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: !disable });
      }
    };

    const handleTouchStart = (e: any) => {
      // Fermer toute autre carte ouverte si on touche cette carte
      if (openCardId !== null && openCardId !== quote.id) {
        setOpenCardId(null);
      }
      dragStartX.current = e.nativeEvent.locationX;
      currentDragX.current = 0;
      lastUpdateX.current = 0;
      dragStartTime.current = Date.now();
      setIsDragging(false);
      verticalScrollDisabled.current = false;
    };

    const handleTouchMove = (e: any) => {
      const currentX = e.nativeEvent.locationX;
      const deltaX = currentX - dragStartX.current;

      // Si la carte est ouverte et qu'on swipe vers la gauche (fermeture)
      if (isOpen && deltaX < -10) {
        if (!verticalScrollDisabled.current) {
          disableParentScroll(true);
          verticalScrollDisabled.current = true;
        }
        setIsDragging(true);
        currentDragX.current = deltaX;
        // Suivre le doigt vers la gauche, mais pas plus loin que 0
        const newValue = Math.max(180 + deltaX, 0);
        translateX.setValue(newValue);
        lastUpdateX.current = newValue;
        return;
      }
      const isWithinEdgeZone = dragStartX.current < EDGE_SWIPE_ZONE;
      const passedThreshold = deltaX > SWIPE_ACTIVATION_THRESHOLD;

      // On ignore les micro mouvements tant que le seuil n'est pas dépassé
      if (!isDragging && (!isWithinEdgeZone || !passedThreshold)) {
        return;
      }

      if (!verticalScrollDisabled.current) {
        disableParentScroll(true);
        verticalScrollDisabled.current = true;
      }
      if (!isDragging) {
        setIsDragging(true);
      }
      currentDragX.current = deltaX;
      // La carte ne commence à bouger qu'après le seuil pour éviter les flashs
      const clampedDelta = Math.max(deltaX - SWIPE_ACTIVATION_THRESHOLD, 0);
      const newValue = Math.min(clampedDelta, 180);
      translateX.setValue(newValue);
      lastUpdateX.current = newValue;
    };

    const handleTouchEnd = (e: any) => {
      disableParentScroll(false);
      if (!isDragging) {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 12,
          bounciness: 0,
        }).start();
        if (isOpen) setOpenCardId(null);
        return;
      }
      
      // Calculer la vélocité (vitesse du swipe en px/ms)
      const swipeDuration = Date.now() - dragStartTime.current;
      const velocity = swipeDuration > 0 ? currentDragX.current / swipeDuration : 0;
      
      // Si la carte était ouverte et qu'on a swipé vers la gauche suffisamment, on referme
      if (isOpen && currentDragX.current < -30) {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 12,
          bounciness: 0,
        }).start();
        setOpenCardId(null);
      }
      // Si swipe vers la droite depuis le bord gauche (ouverture)
      // On ouvre si : distance > 50px OU (distance > 30px ET vélocité > 0.3 px/ms)
      else if (dragStartX.current < EDGE_SWIPE_ZONE && (currentDragX.current > 50 || (currentDragX.current > 30 && velocity > 0.3))) {
        Animated.spring(translateX, {
          toValue: 180,
          useNativeDriver: true,
          speed: 12,
          bounciness: 2,
        }).start();
        setOpenCardId(quote.id);
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 12,
          bounciness: 0,
        }).start();
        setOpenCardId(null);
      }
      setIsDragging(false);
      verticalScrollDisabled.current = false;
    };

    return (
      <View
        key={quote.id}
        style={styles.cardWrapper}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Conteneur avec overflow hidden pour masquer les boutons */}
        <View style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
          {/* Boutons d'action en arrière-plan - toujours visibles mais derrière la carte */}
          <View style={styles.swipeActionsBackground}>
            {/* Bouton Modifier (bleu) */}
            <TouchableOpacity
              style={[styles.swipeButton, styles.editButton]}
              onPress={() => {
                Animated.spring(translateX, {
                  toValue: 0,
                  useNativeDriver: true,
                  speed: 12,
                  bounciness: 0,
                }).start();
                setOpenCardId(null);
                // Navigation vers l'écran d'édition (à implémenter)
                console.log('Modifier la citation', quote.id);
              }}
              activeOpacity={0.8}
            >
              <Edit3 size={20} color="#FFFFFF" />
              <Text style={styles.swipeButtonText}>Modifier</Text>
            </TouchableOpacity>
            
            {/* Bouton Supprimer (rouge) */}
            <TouchableOpacity
              style={[styles.swipeButton, styles.deleteButton]}
              onPress={() => {
                Animated.timing(translateX, {
                  toValue: 300,
                  duration: 300,
                  useNativeDriver: true,
                }).start(() => {
                  handleDeleteQuote(quote.id);
                  setOpenCardId(null);
                });
              }}
              activeOpacity={0.8}
            >
              <Trash2 size={20} color="#FFFFFF" />
              <Text style={styles.swipeButtonText}>Supprimer</Text>
            </TouchableOpacity>
          </View>

          {/* Carte animée au-dessus */}
          <Animated.View style={[styles.cardContainer, { transform: [{ translateX }] }]}> 
            <TouchableOpacity
              style={[styles.quoteCard, { backgroundColor: '#1A1A1A' }]}
              activeOpacity={1}
              onPress={() => {
                if (!isDragging) {
                  // Si la carte est ouverte (glissée), on la ferme au lieu de naviguer
                  if (isOpen) {
                    Animated.spring(translateX, {
                      toValue: 0,
                      useNativeDriver: true,
                      speed: 12,
                      bounciness: 0,
                    }).start();
                    setOpenCardId(null);
                  } else {
                    // Sinon, naviguer vers les détails
                    const currentQuote = quotes.find(q => q.id === quote.id) || quote;
                    navigation.navigate('QuoteDetail', { quote: currentQuote, onToggleLike: () => toggleLike(quote.id) });
                  }
                }
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
          </Animated.View>
        </View>
      </View>
    );
  };

  const toggleSection = (section: 'author' | 'book' | 'year' | null) => {
    setExpandedSection(current => (current === section ? null : section));
  };

  const booksData = useMemo(() => {
    const grouped = quotes.reduce<Record<string, { authors: Set<string>; quoteCount: number }>>((acc, quote) => {
      if (!acc[quote.book]) {
        acc[quote.book] = { authors: new Set(), quoteCount: 0 };
      }
      acc[quote.book].authors.add(quote.author);
      acc[quote.book].quoteCount += 1;
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
  }, [quotes]);
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
        <TouchableOpacity
          style={[styles.statItem, viewMode === 'quotes' && styles.statItemActive]}
          onPress={() => setViewMode('quotes')}
          activeOpacity={0.8}
        >
          <Text style={styles.statValue}>{quotes.length}</Text>
          <Text style={styles.statLabel}>Citations</Text>
        </TouchableOpacity>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{quotes.reduce((acc, q) => acc + q.likes, 0)}</Text>
          <Text style={styles.statLabel}>J'aime</Text>
        </View>
        <TouchableOpacity
          style={[styles.statItem, viewMode === 'books' && styles.statItemActive]}
          onPress={() => setViewMode('books')}
          activeOpacity={0.8}
        >
          <Text style={styles.statValue}>{new Set(quotes.map(q => q.book)).size}</Text>
          <Text style={styles.statLabel}>Livres</Text>
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
          // Fermer la carte ouverte quand on commence à scroller
          if (openCardId !== null) {
            setOpenCardId(null);
          }
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
          quotes.map((quote) => (
            <QuoteCardSwipeable key={quote.id} quote={quote} />
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
    paddingBottom: 80,
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
    zIndex: 1,
  },
  swipeActionsBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 180,
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: -1,
  },
  swipeButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  swipeButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
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