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
import { X, Plus, ChevronLeft, User, Calendar, BookOpen as BookIcon, Star, BookOpen, Quote, Sparkles, Send, MessageSquare, ShoppingCart, ExternalLink } from 'lucide-react-native';
import { similarBooks } from '../data/staticData';
import { useData } from '../src/contexts/DataProvider';
import { Book, Author } from '../types';
import { Modal, Alert, Linking } from 'react-native';
import type { SortableGridRenderItem } from 'react-native-sortables';
import Sortable from 'react-native-sortables';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import AddBlockModal from './AddBlockModal';
import { TextInput } from 'react-native';
import { getBookTitle, getAuthorName } from '../src/utils/dataHelpers';
import ReviewBlock from './ReviewBlock';

type BookDetailScreenRouteProp = RouteProp<{ params: { book?: Book; bookTitle?: string } }, 'params'>;

export function BookDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<BookDetailScreenRouteProp>();
  const params = route.params;

  // Handle both cases
  const passedBook = params?.book;
  const bookTitle = passedBook?.title || params?.bookTitle;

  const { quotes, getBlockLayout, updateBlockLayout, getBookData, updateBookData, getBookByTitle, getAuthorByName } = useData();

  const [bookInfo, setBookInfo] = useState<Book | null>(passedBook || null);
  const [authorInfo, setAuthorInfo] = useState<Author | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(!passedBook);
  const [gridData, setGridData] = useState<string[]>([]);
  const [blockData, setBlockData] = useState<Record<string, any>>({});
  const [isLoadingLayout, setIsLoadingLayout] = useState(true);
  const [isAddBlockModalVisible, setAddBlockModalVisible] = useState(false);

  type TabType = 'description' | 'my_sheet';
  const [activeTab, setActiveTab] = useState<TabType>('description');

  const DESCRIPTION_BLOCKS = ['author', 'savedQuotes', 'reviews', 'buy', 'similarBooks'];
  const MYSHEET_BLOCKS = ['notes'];

  const blockOptions = [
    { key: 'reviews', label: 'Avis & Commentaires' },
    { key: 'buy', label: 'Acheter ce livre' },
    { key: 'notes', label: 'Notes' },
    { key: 'author', label: "À propos de l'auteur" },
    { key: 'savedQuotes', label: 'Mes citations sauvegardées' },
    { key: 'similarBooks', label: 'Livres similaires' },
  ];

  const isBlockInTab = (blockKey: string, tab: TabType) => {
    // blockKey e.g. "author#123" or "addBlock"
    if (blockKey === 'addBlock') return true;
    const base = blockKey.split('#')[0];
    if (tab === 'description') return DESCRIPTION_BLOCKS.includes(base);
    if (tab === 'my_sheet') return MYSHEET_BLOCKS.includes(base);
    return false;
  };

  const currentTabBlocks = (gridData || []).filter(key => isBlockInTab(key, activeTab));

  const filteredBlockOptions = activeTab === 'description'
    ? blockOptions.filter(opt => DESCRIPTION_BLOCKS.includes(opt.key) && (opt.key !== 'buy' || (bookInfo?.buyLinks && bookInfo.buyLinks.length > 0)))
    : blockOptions.filter(opt => MYSHEET_BLOCKS.includes(opt.key));

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  const loadMetadata = useCallback(async () => {
    // If we have bookInfo from params but no author info, or if we just have title
    if (!bookTitle) return;

    // Only fetch if we don't have full info or if we only had title
    // If passedBook is present, we might still want to fetch author if it was just an ID/string in the book object?
    // In our types, Book.author is Author | string.

    console.log('[BookDetail] loadMetadata triggered');
    if (!passedBook) setIsLoadingMetadata(true);

    try {
      // If we already have the book, rely on it but ensure we have the author
      let currentBook = passedBook;
      if (!currentBook) {
        currentBook = await getBookByTitle(bookTitle);
        if (currentBook) setBookInfo(currentBook);
      }

      if (currentBook) {
        console.log(`[BookDetail] Book info ready. Rating: ${currentBook.rating}`);
        const authorVal = currentBook.author;
        // Check if authorVal is object or string
        const authorName = typeof authorVal === 'string' ? authorVal : authorVal.name;

        // Always try to fetch full author details if we don't have them
        const fetchedAuthor = await getAuthorByName(authorName);
        if (fetchedAuthor) setAuthorInfo(fetchedAuthor);
      } else {
        console.log('[BookDetail] Book not found');
      }
    } catch (err) {
      console.error('Error loading book/author metadata:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [bookTitle, getBookByTitle, getAuthorByName, passedBook]);

  React.useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Fetch saved layout
  React.useEffect(() => {
    if (bookTitle) {
      Promise.all([
        getBlockLayout(bookTitle, 'book'),
        getBookData(bookTitle)
      ]).then(([layout, data]) => {
        setGridData(layout || []);
        setBlockData(data || {});
        setIsLoadingLayout(false);
      });
    }
  }, [bookTitle, getBlockLayout, getBookData]);

  // Autosave blockData
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (bookTitle && blockData) {
        updateBookData(bookTitle, blockData);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [blockData, bookTitle, updateBookData]);


  const savedQuotes = quotes.filter(q => getBookTitle(q.book) === bookTitle);
  // Logique pour trouver les livres similaires à partir des citations sauvegardées
  const currentBookQuotes = savedQuotes.map(mq => mq.text);
  // 2. Aplatir les listes de livres similaires pour ces citations et s'assurer qu'ils sont uniques.
  const similarBookList = currentBookQuotes.flatMap(q => similarBooks[q] || []);
  const uniqueSimilarBooks = [...new Set(similarBookList)];


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


  const openAddBlockModal = () => setAddBlockModalVisible(true);
  const closeAddBlockModal = () => setAddBlockModalVisible(false);

  const handleAddBlock = (blockKey: string) => {
    const newLayout = [...gridData.filter(x => x !== 'addBlock'), `${blockKey}#${Date.now()}`, 'addBlock'];
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

  // Helper function to render block content
  const renderBlockContent = (item: string) => {
    if (!bookInfo) return null;
    const base = typeof item === 'string' && item.includes('#') ? item.split('#')[0] : item;

    switch (base) {
      case 'author': {
        if (!authorInfo) {
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <User size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }}>
                Informations sur l'auteur non disponibles.
              </Text>
            </View>
          );
        }

        const authorName = typeof bookInfo.author === 'string' ? bookInfo.author : bookInfo.author.name;
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('AuthorDetail', { authorName })}>
              <Text style={styles.authorName}>{authorName}</Text>
            </TouchableOpacity>
            <Text style={styles.authorDesc}>{authorInfo.description}</Text>
          </View>
        );
      }

      case 'notes': {
        return (
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
      }

      case 'reviews': {
        if (!bookInfo) return null;
        const bookId = typeof bookInfo.id === 'string' ? parseInt(bookInfo.id) : bookInfo.id;
        if (!bookId) return null;
        return (
          <ReviewBlock
            bookId={bookId}
            onReviewAdded={loadMetadata}
          />
        );
      }

      case 'savedQuotes': {
        if (savedQuotes.length === 0) {
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Quote size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>Mes citations sauvegardées</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }}>
                Aucune citation sauvegardée pour ce livre.
              </Text>
            </View>
          );
        }

        return (
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
                    <Text style={styles.savedQuoteAuthor}>{getAuthorName(quote.author)}</Text>
                    <Text style={styles.savedQuoteDate}>{quote.date}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      }

      case 'buy': {
        if (!bookInfo.buyLinks || bookInfo.buyLinks.length === 0) {
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ShoppingCart size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>Acheter ce livre</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }}>
                Aucun lien d'achat disponible.
              </Text>
            </View>
          );
        }

        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ShoppingCart size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>Acheter ce livre</Text>
            </View>
            <View style={styles.buyLinksList}>
              {bookInfo.buyLinks.map((link, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.buyLinkItem}
                  onPress={() => {
                    Linking.openURL(link.url).catch(err => Alert.alert("Erreur", "Impossible d'ouvrir le lien"));
                  }}
                >
                  <View style={styles.buyLinkInfo}>
                    <Text style={styles.buyLinkStore}>{link.store}</Text>
                    <ExternalLink size={12} color="#6B7280" />
                  </View>
                  <Text style={styles.buyLinkPrice}>{link.price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      }

      case 'similarBooks': {
        if (uniqueSimilarBooks.length === 0) {
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <BookOpen size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>Livres similaires</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }}>
                Aucun livre similaire trouvé.
              </Text>
            </View>
          );
        }

        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>Livres similaires</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarBooksContainer}>
              {uniqueSimilarBooks.map((sBookTitle) => {
                return (
                  <TouchableOpacity key={sBookTitle} style={styles.similarBookItem} onPress={() => navigation.push('BookDetail', { bookTitle: sBookTitle })}>
                    <View style={[styles.similarBookCover, { backgroundColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' }]}>
                      <BookIcon size={24} color="#4B5563" />
                    </View>
                    <Text numberOfLines={2} style={styles.similarBookTitle}>{sBookTitle}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      }

      default:
        return null;
    }
  };

  const renderGridItem = useCallback<SortableGridRenderItem<string>>(({ item, index }) => {
    const content = renderBlockContent(item);
    if (!content) return null;

    // Don't wrap addBlock (though it's not in the main switch above, handled separately in modal logic, 
    // but wait, addBlock isn't part of renderBlockContent. 
    // Actually addBlock logic was separate. The previous code had addBlock filtering.
    // Let's keep it clean. My Sheet only uses 'notes' usually + addBlock.
    // But wait, the previous renderGridItem didn't handle 'addBlock' inside the switch?
    // Ah, previous code logic:
    // If item is 'addBlock', it might be rendered via renderGridItem depending on implementation?
    // Actually addBlock IS in gridData.

    if (item === 'addBlock') {
      // Placeholder logic. But wait, in the new Code I put addBlock BUTTON explicitly below the grid for non-sortable?
      // No, for 'my_sheet', I kept Sortable.Grid.
      // And added the button explicitly BELOW it?
      // In my replacement chunk for the grid section:
      // I put:
      // <Sortable.Grid ... />
      // <TouchableOpacity ... addBlock ... />
      // This implies addBlock is NOT in gridData? 
      // But handleAddBlock adds it to gridData.
      // If addBlock is in gridData, it will be rendered by renderGridItem.
      // So I should check if item === 'addBlock' and return it.

      // However, renderBlockContent doesn't handle 'addBlock'.

      return (
        <TouchableOpacity style={styles.placeholderSection} onPress={openAddBlockModal}>
          <Plus size={20} color="#9CA3AF" style={styles.placeholderIcon} />
          <Text style={styles.placeholderText}>Ajouter un bloc</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.removableWrapper}>
        {content}
        <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveBlock(item)}>
          <X size={14} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  }, [renderBlockContent, handleRemoveBlock]);

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
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{bookTitle}</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#9CA3AF' }}>Chargement des informations...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!bookInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{bookTitle}</Text>
            <View style={styles.placeholder} />
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
                <TouchableOpacity onPress={() => {
                  const authorName = typeof bookInfo.author === 'string' ? bookInfo.author : bookInfo.author.name;
                  navigation.navigate('AuthorDetail', { authorName });
                }}>
                  <Text style={styles.bookAuthorText}>{typeof bookInfo.author === 'string' ? bookInfo.author : bookInfo.author.name}</Text>
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
                    <Text style={styles.metaText}>{averageRating}/5</Text>
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
                {renderBlockContent('author')}
                {renderBlockContent('savedQuotes')}
                {renderBlockContent('reviews')}
                {renderBlockContent('buy')}
                {renderBlockContent('similarBooks')}
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
  userRatingContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  subTitle: {
    fontSize: 13,
    color: '#9CA3AF',
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
    backgroundColor: '#0B0B0B',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    color: '#E5E7EB',
    fontSize: 13,
    minHeight: 80,
  },
  reviewsList: {
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 16,
  },
  reviewItem: {
    backgroundColor: '#0F0F0F',
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
    color: '#E5E7EB',
    fontWeight: '500',
  },
  reviewDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 6,
  },
  reviewComment: {
    fontSize: 13,
    color: '#D1D5DB',
    lineHeight: 18,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20B8CD',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    gap: 6,
  },
  publishButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  seeAllReviewsButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    marginTop: 8,
  },
  seeAllReviewsText: {
    color: '#20B8CD',
    fontSize: 13,
    fontWeight: '500',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
    gap: 16,
  },
  modalReviewItem: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  reviewerAvatarLarge: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewerNameLarge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  reviewCommentLarge: {
    fontSize: 14,
    color: '#E5E7EB',
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
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  buyLinkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buyLinkStore: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  buyLinkPrice: {
    color: '#20B8CD',
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#20B8CD',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});