import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { X, Plus, ChevronLeft, User, Calendar, BookOpen as BookIcon, Star, BookOpen, Quote, Sparkles } from 'lucide-react-native';
import { bookDescriptions, authorDetails, similarBooks, localQuotesDB } from '../data/staticData';
import { useData } from '../src/contexts/DataProvider';
import type { SortableGridRenderItem } from 'react-native-sortables';
import Sortable from 'react-native-sortables';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import AddBlockModal from './AddBlockModal';
import { TextInput } from 'react-native';

type BookDetailScreenRouteProp = RouteProp<{ params: { bookTitle: string } }, 'params'>;

export function BookDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<BookDetailScreenRouteProp>();
  // Le titre du livre peut être passé plusieurs fois, on s'assure de ne pas avoir de problème
  const bookTitle = route.params?.bookTitle;

  const bookInfo = bookDescriptions[bookTitle];

  if (!bookInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* On peut ajouter un bouton de retour ici aussi */}
          <Text style={styles.errorText}>Livre non trouvé.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const savedQuotes = localQuotesDB.filter(mq => mq.book === bookTitle);
  // Logique pour trouver les livres similaires à partir des citations sauvegardées
  const currentBookQuotes = savedQuotes.map(mq => mq.text);
  // 2. Aplatir les listes de livres similaires pour ces citations et s'assurer qu'ils sont uniques.
  const similarBookList = currentBookQuotes.flatMap(q => similarBooks[q] || []);
  const uniqueSimilarBooks = [...new Set(similarBookList)];

  const { getBlockLayout, updateBlockLayout, getBookData, updateBookData } = useData();
  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  // Use unique ids per instance so duplicates are allowed and removable individually
  const [gridData, setGridData] = useState<string[]>([]);
  const [blockData, setBlockData] = useState<Record<string, any>>({});
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);

  // Fetch saved layout
  React.useEffect(() => {
    if (bookTitle) {
      Promise.all([
        getBlockLayout(bookTitle, 'book'),
        getBookData(bookTitle)
      ]).then(([layout, data]) => {
        setGridData(layout);
        setBlockData(data);
        setIsLoadingLayout(false);
      });
    }
  }, [bookTitle]);

  // Autosave blockData
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (bookTitle && blockData) {
        updateBookData(bookTitle, blockData);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [blockData, bookTitle]);

  const handleUpdateBlockData = (blockId: string, data: any) => {
    setBlockData(current => ({ ...current, [blockId]: data }));
  };

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

  // Add-block modal state and helpers
  const [isAddBlockModalVisible, setAddBlockModalVisible] = useState(false);
  const blockOptions = [
    { key: 'notes', label: 'Notes' },
    { key: 'author', label: "À propos de l'auteur" },
    { key: 'savedQuotes', label: 'Mes citations sauvegardées' },
    { key: 'similarBooks', label: 'Livres similaires' },
  ];
  const openAddBlockModal = () => setAddBlockModalVisible(true);
  const closeAddBlockModal = () => setAddBlockModalVisible(false);

  const handleAddBlock = (blockKey: string) => {
    const newLayout = [...gridData.filter(x => x !== 'addBlock'), `${blockKey}#${Date.now()}`, 'addBlock'];
    setGridData(newLayout);
    if (bookTitle) updateBlockLayout(bookTitle, 'book', newLayout);
    closeAddBlockModal();
  };

  const handleRemoveBlockAt = (indexToRemove: number) => {
    if (indexToRemove < 0 || indexToRemove >= gridData.length) return;
    if (gridData[indexToRemove] === 'addBlock') return;

    const arr = [...gridData];
    arr.splice(indexToRemove, 1);
    const newLayout = [...arr.filter(x => x !== 'addBlock'), 'addBlock'];

    setGridData(newLayout);
    if (bookTitle) updateBlockLayout(bookTitle, 'book', newLayout);
  };

  const renderGridItem = useCallback<SortableGridRenderItem<string>>(({ item, index }) => {
    const base = typeof item === 'string' && item.includes('#') ? item.split('#')[0] : item;
    switch (base) {
      case 'author':
        if (!authorDetails[bookInfo.author]) return null;
        {
          const content = (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <User size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AuthorDetail', { authorName: bookInfo.author })}>
                <Text style={styles.authorName}>{bookInfo.author}</Text>
              </TouchableOpacity>
              <Text style={styles.authorDesc}>{authorDetails[bookInfo.author].description}</Text>
            </View>
          );
          return (
            <View style={styles.removableWrapper}>
              {content}
              <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveBlockAt(index)}>
                <X size={14} color="#EF4444" />
              </TouchableOpacity>
            </View>
          );
        }

      case 'notes':
        {
          const content = (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Sparkles size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>Notes</Text>
              </View>
              <TextInput
                style={styles.notesInput}
                placeholder="Écrire des notes sur ce livre..."
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={6}
                value={blockData?.[item] ?? ''}
                onChangeText={(text) => handleUpdateBlockData(item, text)}
                textAlignVertical="top"
              />
            </View>
          );
          return (
            <View style={styles.removableWrapper}>
              {content}
              <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveBlockAt(index)}>
                <X size={14} color="#EF4444" />
              </TouchableOpacity>
            </View>
          );
        }

      case 'savedQuotes':
        if (savedQuotes.length === 0) return null;
        {
          const content = (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Quote size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>Mes citations sauvegardées</Text>
              </View>
              <View style={styles.savedQuotesList}>
                {savedQuotes.map(quote => (
                  <TouchableOpacity
                    key={quote.id}
                    style={styles.savedQuoteCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('QuoteDetail', { quote })}
                  >
                    <Text style={styles.savedQuoteText}>{quote.text}</Text>
                    <View style={styles.savedQuoteMeta}>
                      <Text style={styles.savedQuoteAuthor}>{quote.author}</Text>
                      <Text style={styles.savedQuoteDate}>{quote.date}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
          return (
            <View style={styles.removableWrapper}>
              {content}
              <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveBlockAt(index)}>
                <X size={14} color="#EF4444" />
              </TouchableOpacity>
            </View>
          );
        }

      case 'similarBooks':
        if (uniqueSimilarBooks.length === 0) return null;
        {
          const content = (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <BookOpen size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>Livres similaires</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarBooksContainer}>
                {uniqueSimilarBooks.map((sBookTitle) => {
                  const similarBookInfo = bookDescriptions[sBookTitle];
                  if (!similarBookInfo) return null;
                  return (
                    <TouchableOpacity key={sBookTitle} style={styles.similarBookItem} onPress={() => navigation.push('BookDetail', { bookTitle: sBookTitle })}>
                      <Image source={{ uri: similarBookInfo.cover }} style={styles.similarBookCover} />
                      <Text numberOfLines={2} style={styles.similarBookTitle}>{sBookTitle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
          return (
            <View style={styles.removableWrapper}>
              {content}
              <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveBlockAt(index)}>
                <X size={14} color="#EF4444" />
              </TouchableOpacity>
            </View>
          );
        }



      default:
        return null;
    }
  }, [navigation, bookInfo, savedQuotes, uniqueSimilarBooks]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
          <View style={styles.placeholder} />
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
                <TouchableOpacity onPress={() => navigation.navigate('AuthorDetail', { authorName: bookInfo.author })}>
                  <Text style={styles.bookAuthorText}>{bookInfo.author}</Text>
                </TouchableOpacity>

                {/* Book Meta Info */}
                <View style={styles.bookMeta}>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{bookInfo.year}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <BookIcon size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{bookInfo.pages} p.</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Star size={14} color="#20B8CD" fill="#20B8CD" />
                    <Text style={styles.metaText}>{bookInfo.rating}/5</Text>
                  </View>
                </View>

                {/* Genre Badge */}
                <View style={styles.genreBadge}>
                  <Text style={styles.genreText}>{bookInfo.genre}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.bookDesc}>{bookInfo.description}</Text>
          </View>

          <View style={styles.gridSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Organiser les blocs</Text>
            </View>
            <Sortable.Grid
              columns={1}
              data={gridData}
              renderItem={renderGridItem}
              rowGap={10}
              columnGap={10}
              scrollableRef={scrollableRef}
              autoScrollEnabled={true}
              autoScrollActivationOffset={75}
              onOrderChange={(params) => {
                const { fromIndex, toIndex } = params as { fromIndex: number; toIndex: number };
                handleOrderChange(fromIndex, toIndex);
              }}
            />
            <TouchableOpacity style={styles.placeholderSection} onPress={openAddBlockModal}>
              <Plus size={20} color="#9CA3AF" style={styles.placeholderIcon} />
              <Text style={styles.placeholderText}>Ajouter un bloc</Text>
            </TouchableOpacity>
            <AddBlockModal visible={isAddBlockModalVisible} onClose={closeAddBlockModal} onSelect={handleAddBlock} options={blockOptions} />
          </View>
        </Animated.ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0F0F' },
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', flex: 1, textAlign: 'center' },
  placeholder: { width: 28 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  section: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
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
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bookAuthorText: {
    fontSize: 14,
    color: '#20B8CD',
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
    color: '#9CA3AF',
  },
  genreBadge: {
    backgroundColor: 'rgba(32, 184, 205, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  genreText: {
    fontSize: 11,
    color: '#20B8CD',
    fontWeight: '500',
  },
  bookDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9CA3AF',
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
    color: '#FFFFFF',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#20B8CD',
    marginBottom: 8,
  },
  authorDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9CA3AF',
  },
  savedQuotesList: {
    gap: 12,
  },
  savedQuoteCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 12,
  },
  savedQuoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#E5E7EB',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  savedQuoteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  savedQuoteAuthor: {
    fontSize: 12,
    color: '#20B8CD',
  },
  savedQuoteDate: {
    fontSize: 12,
    color: '#6B7280',
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
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 16,
  },
  placeholderSection: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0F0F',
  },
  placeholderIcon: {
    marginBottom: 8,
  },
  placeholderText: {
    color: '#9CA3AF',
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
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  gridSection: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: 'white', textAlign: 'center', marginTop: 50 },
  notesInput: {
    backgroundColor: '#0B0B0B',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    color: '#E5E7EB',
    fontSize: 13,
    minHeight: 120,
  },
});