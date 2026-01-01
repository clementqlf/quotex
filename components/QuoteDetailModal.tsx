import React, { useCallback } from 'react';
import {
  View,
  Share,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  TextInput,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { X, Calendar, User as UserIcon, Sparkles, BookOpen, Heart, Share2, Star, Plus } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import {
  aiInterpretations,
  authorDetails,
  bookDescriptions,
  definitions,
  similarBooks,
  similarAuthors,
} from '../data/staticData';
import type { SortableGridRenderItem } from 'react-native-sortables';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Sortable from 'react-native-sortables';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import AddBlockModal from './AddBlockModal';
import { useData } from '../src/contexts/DataProvider';
import { Quote, User } from '../types';
import { getBookTitle, getAuthorName } from '../src/utils/dataHelpers';
import { formatRelativeDate } from '../src/utils/dateUtils';


// Local types removed in favor of imports from ../types
import WordSelectionModal from './WordSelectionModal';
import { fetchDefinition } from '../src/services/WiktionaryService';

// Le composant n'a plus besoin de props, il va tout chercher dans la route.
export function QuoteDetailModal() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: { quote: Quote } }, 'params'>>();
  const { quote: initialQuote } = route.params ?? {};

  // On utilise un état local pour la citation afin de pouvoir la mettre à jour
  const [quote, setQuote] = React.useState(initialQuote);

  // Persistence integration
  const { getBlockLayout, updateBlockLayout, updateQuote, toggleLikeQuote } = useData();
  const [gridData, setGridData] = React.useState<string[]>([]);
  const [isLoadingLayout, setIsLoadingLayout] = React.useState(true);

  type TabType = 'description' | 'my_sheet';
  const [activeTab, setActiveTab] = React.useState<TabType>('description');

  const DESCRIPTION_BLOCKS = ['bookInfo', 'author', 'similarBooks', 'similarAuthors'];
  const MYSHEET_BLOCKS = ['definition', 'notes'];

  const blockOptions = [
    { key: 'definition', label: 'Définition' },
    { key: 'notes', label: 'Notes' },
    { key: 'bookInfo', label: "À propos du livre" },
    { key: 'author', label: "À propos de l'auteur" },
    { key: 'similarBooks', label: 'Livres similaires' },
    { key: 'similarAuthors', label: 'Auteurs similaires' },
  ];

  const isBlockInTab = (blockKey: string, tab: TabType) => {
    if (blockKey === 'addBlock') return true;
    const base = blockKey.split('#')[0];
    if (tab === 'description') return DESCRIPTION_BLOCKS.includes(base);
    if (tab === 'my_sheet') return MYSHEET_BLOCKS.includes(base);
    return false;
  };

  const currentTabBlocks = (gridData || []).filter(key => isBlockInTab(key, activeTab));

  const filteredBlockOptions = activeTab === 'description'
    ? blockOptions.filter(opt => DESCRIPTION_BLOCKS.includes(opt.key))
    : blockOptions.filter(opt => MYSHEET_BLOCKS.includes(opt.key));

  React.useEffect(() => {
    if (quote?.id) {
      getBlockLayout(quote.id, 'quote').then(layout => {
        setGridData(layout);
        setIsLoadingLayout(false);
      });
    }
  }, [quote?.id]);

  // Autosave notes/blockData
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (quote?.id && quote.blockData) {
        updateQuote(quote.id, { blockData: quote.blockData });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [quote?.blockData, quote?.id]);

  const handleOrderChange = (fromIndex: number, toIndex: number) => {
    setGridData(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      // Persist change
      if (quote?.id) updateBlockLayout(quote.id, 'quote', arr);
      return arr;
    });
  };

  const handleUpdateBlockData = (blockId: string, data: any) => {
    setQuote(current => {
      if (!current) return current;
      const newBlockData = { ...current.blockData, [blockId]: data };
      return { ...current, blockData: newBlockData };
    });
  };

  if (!quote) return null;

  const onClose = () => navigation.goBack();

  // Cette fonction met à jour l'état local ET appelle la fonction du contexte
  const handleToggleLike = () => {
    // 1. Mettre à jour l'état de la modale pour un retour visuel immédiat
    setQuote(currentQuote => {
      if (!currentQuote) return currentQuote;
      return { ...currentQuote, isLiked: !currentQuote.isLiked, likesCount: currentQuote.isLiked ? currentQuote.likesCount - 1 : currentQuote.likesCount + 1 };
    });
    // 2. Appeler la fonction du contexte pour mettre à jour l'état global
    toggleLikeQuote(quote.id);
  };

  const handleShare = async () => {
    try {
      const message = `"${quote.text}"\n- ${quoteAuthorName}\n(via Quotex)`;
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const onAuthorPress = (authorName: string) => navigation.navigate('AuthorDetail', { authorName });
  const onBookPress = (bookTitle: string) => navigation.navigate('BookDetail', { bookTitle });

  const quoteAuthorName = getAuthorName(quote.author);
  const quoteBookTitle = getBookTitle(quote.book);

  // Data logic dependencies
  const aiInterpretation =
    aiInterpretations[quote.text] ||
    "Cette citation nous invite à réfléchir sur notre condition humaine et nos aspirations.";
  const authorInfo = authorDetails[quoteAuthorName];
  const authorDesc = authorInfo?.description || `${quoteAuthorName} est un auteur reconnu.`;
  const similarBookList =
    similarBooks[quote.text] || [];
  const bookAuthor = authorInfo ? quoteAuthorName : quoteAuthorName; // Simplified fallback
  const similarAuthorList = similarAuthors[bookAuthor] || [];
  const bookInfo = bookDescriptions[quoteBookTitle];
  const quoteTheme = quote.theme || 'Thème non renseigné';

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  // State and helpers for "Ajouter un bloc"
  const [isAddBlockModalVisible, setAddBlockModalVisible] = React.useState(false);
  const [isWordSelectionModalVisible, setWordSelectionModalVisible] = React.useState(false);
  const [currentDefinitionBlockId, setCurrentDefinitionBlockId] = React.useState<string | null>(null);

  const handleWordsSelected = async (words: string[]) => {
    if (!currentDefinitionBlockId) return;

    // Fetch definitions for all selected words
    // We can show a loading indicator here if needed, but for now we'll just wait
    // Ideally we should have a 'loading' state for the block itself or the modal

    const newDefinitions = [];
    for (const word of words) {
      const def = await fetchDefinition(word);
      if (def) {
        newDefinitions.push(def);
      } else {
        // Fallback if no definition found
        newDefinitions.push({
          term: word,
          genre: 'Non trouvé',
          definition: "Aucune définition trouvée pour ce mot.",
          example: ''
        });
      }
    }

    handleUpdateBlockData(currentDefinitionBlockId, newDefinitions);
    setWordSelectionModalVisible(false);
    setCurrentDefinitionBlockId(null);
  };




  const openAddBlockModal = () => setAddBlockModalVisible(true);
  const closeAddBlockModal = () => setAddBlockModalVisible(false);

  const handleAddBlock = (blockKey: string) => {
    const newLayout = [...gridData.filter(x => x !== 'addBlock'), `${blockKey}#${Date.now()}`, 'addBlock'];
    setGridData(newLayout);
    if (quote?.id) updateBlockLayout(quote.id, 'quote', newLayout);
    closeAddBlockModal();
  };

  const handleRemoveBlock = (itemToRemove: string) => {
    if (itemToRemove === 'addBlock') return;

    const newLayout = gridData.filter(x => x !== itemToRemove);

    setGridData(newLayout);
    if (quote?.id) updateBlockLayout(quote.id, 'quote', newLayout);
  };

  // Helper function to render block content without wrappers
  const renderBlockContent = (item: string) => {
    const base = typeof item === 'string' && item.includes('#') ? item.split('#')[0] : item;

    switch (base) {
      case 'definition': {
        // Check if we have data for this definition block
        const blockDefinitionData = quote?.blockData?.[item] as { term: string, genre: string, definition: string, example: string }[] | undefined;

        // If no data (or legacy behavior check), render the placeholder state to select words
        if (!blockDefinitionData || blockDefinitionData.length === 0) {
          // Placeholder content for definition
          return (
            <TouchableOpacity
              style={styles.emptyBlockContainer}
              onPress={() => {
                setCurrentDefinitionBlockId(item);
                setWordSelectionModalVisible(true);
              }}
            >
              <BookOpen size={24} color="#20B8CD" />
              <Text style={styles.emptyBlockText}>Cliquez pour définir des mots</Text>
              <Text style={styles.emptyBlockSubtext}>Sélectionner des mots de la citation pour afficher leur définition.</Text>
            </TouchableOpacity>
          );
        }

        return (
          <View style={styles.definitionSection}>
            <View style={styles.sectionHeader}>
              <BookOpen size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>Définition</Text>
            </View>
            <View style={styles.definitionContent}>
              {blockDefinitionData.map((dItem, defIndex) => (
                <View key={defIndex}>
                  <Text style={styles.definitionTerm}>{dItem.term}</Text>
                  <Text style={styles.definitionGenre}>{dItem.genre}</Text>
                  <Text style={styles.definitionDesc}>{dItem.definition}</Text>
                  <Text style={styles.definitionExample}><Text style={styles.exampleLabel}>Exemple : </Text>{dItem.example}</Text>
                  {defIndex !== blockDefinitionData.length - 1 && <View style={styles.definitionDivider} />}
                </View>
              ))}
            </View>
            {/* Button to edit selection */}
            <TouchableOpacity
              style={styles.editSelectionButton}
              onPress={() => {
                setCurrentDefinitionBlockId(item);
                setWordSelectionModalVisible(true);
              }}
            >
              <Text style={styles.editSelectionText}>Modifier la sélection</Text>
            </TouchableOpacity>
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
              placeholder="Écrire des notes..."
              placeholderTextColor="#6B7280"
              multiline
              numberOfLines={6}
              value={quote?.blockData?.[item] ?? ''}
              onChangeText={(text) => handleUpdateBlockData(item, text)}
              textAlignVertical="top"
            />
          </View>
        );
      }

      case 'bookInfo': {
        if (!bookInfo) {
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <BookOpen size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>À propos du livre</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }}>
                Informations sur le livre non disponibles pour cette citation.
              </Text>
            </View>
          );
        }
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>À propos du livre</Text>
            </View>
            <TouchableOpacity style={styles.bookContainer} onPress={() => onBookPress(quoteBookTitle)}>
              <Image source={{ uri: bookInfo.cover }} style={styles.bookCover} />
              <View style={styles.bookInfo}>
                <TouchableOpacity onPress={() => onBookPress(quoteBookTitle)}>
                  <Text style={styles.bookName}>{quoteBookTitle}</Text>
                </TouchableOpacity>
                <View style={styles.bookMeta}>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{bookInfo.year}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <BookOpen size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{bookInfo.pages} p.</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Star size={14} color="#20B8CD" fill="#20B8CD" />
                    <Text style={styles.metaText}>{bookInfo.rating}/5</Text>
                  </View>
                </View>
                <View style={styles.genreBadge}>
                  <Text style={styles.genreText}>{bookInfo.genre}</Text>
                </View>
              </View>
            </TouchableOpacity>
            <Text style={styles.bookDesc}>{bookInfo.description}</Text>
          </View>
        );
      }

      case 'author': {
        if (!authorInfo && !authorDesc) {
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <UserIcon size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }}>
                Informations sur l'auteur non disponibles.
              </Text>
            </View>
          );
        }
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <UserIcon size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
            </View>
            <TouchableOpacity onPress={() => onAuthorPress(quoteAuthorName)}>
              <Text style={styles.authorName}>{quoteAuthorName}</Text>
              <Text style={styles.authorDesc}>{authorDesc}</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case 'similarBooks': {
        const hasSimilarBooks = similarBookList && similarBookList.length > 0;
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>Livres similaires</Text>
            </View>
            {hasSimilarBooks ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarBooksContainer}>
                {similarBookList.map((bookTitle) => {
                  const similarBookInfo = bookDescriptions[bookTitle];
                  if (!similarBookInfo) return null;
                  return (
                    <TouchableOpacity key={bookTitle} style={styles.similarBookItem} onPress={() => navigation.push('BookDetail', { bookTitle })}>
                      <Image source={{ uri: similarBookInfo.cover }} style={styles.similarBookCover} />
                      <Text numberOfLines={2} style={styles.similarBookTitle}>{bookTitle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }}>
                Aucun livre similaire trouvé.
              </Text>
            )}
          </View>
        );
      }

      case 'similarAuthors': {
        const hasSimilarAuthors = similarAuthorList && similarAuthorList.length > 0;
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <UserIcon size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>Auteurs similaires</Text>
            </View>
            {hasSimilarAuthors ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarBooksContainer}>
                {similarAuthorList.map((authorName) => {
                  const authorBook = Object.values(bookDescriptions).find(book => book.author === authorName);
                  const authorCover = authorBook ? authorBook.cover : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400&h=600&fit=crop';
                  return (
                    <TouchableOpacity key={authorName} style={styles.similarBookItem} onPress={() => navigation.push('AuthorDetail', { authorName })}>
                      <Image source={{ uri: authorCover }} style={styles.similarBookCover} />
                      <Text numberOfLines={2} style={styles.similarBookTitle}>{authorName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }}>
                Aucun auteur similaire trouvé.
              </Text>
            )}
          </View>
        );
      }

      case 'addBlock':
        return (
          <TouchableOpacity style={styles.placeholderSection} onPress={openAddBlockModal}>
            <Plus size={20} color="#9CA3AF" style={styles.placeholderIcon} />
            <Text style={styles.placeholderText}>Ajouter un bloc</Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  // Render function for sortable grid items (defined after data constants)
  const renderGridItem = useCallback<SortableGridRenderItem<string>>(({ item, index }) => {
    const content = renderBlockContent(item);
    if (!content) return null;

    // We do NOT want to wrap 'addBlock' in the removable wrapper
    if (item === 'addBlock') {
      return content; // It already has its own touchable style
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

  return (
    <View style={styles.container}>
      {/* Arrière-plan semi-transparent qui ferme le modal au clic */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.modalView}>
        {/* Poignée pour indiquer qu'on peut slider */}
        <View style={styles.handleBar} />

        <Animated.ScrollView
          ref={scrollableRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Détails de la citation</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          {/* Quote Section */}
          <View style={styles.section}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                fill="#20B8CD"
                opacity={0.2}
              />
            </Svg>
            <Text style={styles.quoteText}>{quote.text}</Text>

            {/* Book & Author + Theme badge à droite */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A2A', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={styles.metaRow} onPress={() => onBookPress(quoteBookTitle)}>
                  <BookOpen size={16} color="#6B7280" />
                  <Text style={styles.metaTextBook}>{quoteBookTitle}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.metaRow} onPress={() => onAuthorPress(quoteAuthorName)}>
                  <UserIcon size={16} color="#6B7280" />
                  <Text style={styles.metaTextAuthor}>{quoteAuthorName}</Text>
                </TouchableOpacity>
                {quote.user && (
                  <TouchableOpacity style={styles.metaRow} onPress={() => navigation.navigate('UserProfile', { user: quote.user })}>
                    <Image
                      source={{ uri: quote.user.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }}
                      style={styles.publisherAvatar}
                    />
                    <Text style={styles.metaTextPublisher}>Publié par <Text style={styles.publisherUsername}>@{quote.user.username}</Text></Text>
                  </TouchableOpacity>
                )}
                {quote.date && (
                  <View style={styles.metaRow}>
                    <Calendar size={16} color="#6B7280" />
                    <Text style={styles.metaTextDate}>{formatRelativeDate(quote.date)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.themeBadgeIA}>
                <Text style={styles.themeBadgeValue}>{quoteTheme}</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleToggleLike}
            >
              <Heart
                size={20}
                color={quote.isLiked ? '#20B8CD' : '#6B7280'}
                fill={quote.isLiked ? '#20B8CD' : 'none'}
              />
              <Text
                style={[
                  styles.actionText,
                  quote.isLiked && styles.actionTextActive,
                ]}
              >
                {quote.likesCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Share2 size={20} color="#6B7280" />
              <Text style={styles.actionText}>Partager</Text>
            </TouchableOpacity>
          </View>

          {/* AI Interpretation */}
          <View style={styles.aiSection}>
            <View style={styles.aiHeader}>
              <Sparkles size={16} color="#20B8CD" />
              <Text style={styles.aiTitle}>Interprétation IA</Text>
            </View>
            <Text style={styles.aiText}>{aiInterpretation}</Text>
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



          {/* Placeholder block */}
          {/* Sortable Grid to arrange blocks */}
          {/* Sortable Grid to arrange blocks */}
          {/* Tab Content */}
          <View style={styles.gridSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {activeTab === 'description' ? 'Détails' : 'Mon espace personnel'}
              </Text>
            </View>

            {activeTab === 'description' ? (
              <View style={{ gap: 10 }}>
                {/* Description Fixed Blocks */}
                {renderBlockContent('bookInfo')}
                {renderBlockContent('author')}
                {renderBlockContent('similarBooks')}
                {renderBlockContent('similarAuthors')}
              </View>
            ) : (
              // My Sheet Sortable Grid
              <>
                <Sortable.Grid
                  columns={1}
                  data={currentTabBlocks}
                  renderItem={renderGridItem}
                  rowGap={10}
                  columnGap={10}
                  scrollableRef={scrollableRef} // Utiliser la ref du ScrollView parent
                  autoScrollEnabled={true}
                  autoScrollActivationOffset={75}
                  onOrderChange={(params) => {
                    const { fromIndex, toIndex } = params as { fromIndex: number; toIndex: number };
                    // logic needs to map back to original gridData indices if we want to support reorder
                    // Sortable.Grid works on the data passed to it (currentTabBlocks). 

                    // Helper to reorder the master list based on the sub-list change
                    const newSubOrder = [...currentTabBlocks];
                    const [moved] = newSubOrder.splice(fromIndex, 1);
                    newSubOrder.splice(toIndex, 0, moved);

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

                    setGridData(newMasterList);
                    if (quote?.id) updateBlockLayout(quote.id, 'quote', newMasterList);
                  }}
                />
                <AddBlockModal visible={isAddBlockModalVisible} onClose={closeAddBlockModal} onSelect={handleAddBlock} options={filteredBlockOptions} />

                <WordSelectionModal
                  visible={isWordSelectionModalVisible}
                  onClose={() => setWordSelectionModalVisible(false)}
                  onConfirm={handleWordsSelected}
                  quoteText={quote.text}
                />
              </>
            )}
          </View>

        </Animated.ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  modalView: {
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: Dimensions.get('window').height * 0.9, // Occupe 90% de l'écran
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
    paddingTop: 12, // Espace pour la poignée
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A2A2A',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  themeBadgeIA: {
    backgroundColor: 'rgba(32, 184, 205, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    marginLeft: 12,
  },
  themeBadgeLabel: {
    fontSize: 10,
    color: '#05252C',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  themeBadgeValue: {
    fontSize: 14,
    color: '#20B8CD',
    fontWeight: '600',
  },
  quoteText: {
    fontSize: 24, // Encore plus grand pour un impact visuel fort
    lineHeight: 36, // Ajusté pour la nouvelle taille
    color: '#E5E7EB',
    marginVertical: 12,
    fontFamily: 'Times New Roman', // Police encore plus classique et formelle
    fontStyle: 'italic',
    fontWeight: '100'
  },
  metadata: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaTextBook: {
    color: '#20B8CD',
    fontSize: 13,
  },
  metaTextAuthor: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  metaTextDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  publisherAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  metaTextPublisher: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  publisherUsername: {
    color: '#E5E7EB',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
  },
  actionText: {
    fontSize: 13,
    color: '#6B7280',
  },
  actionTextActive: {
    color: '#20B8CD',
  },
  aiSection: {
    backgroundColor: 'rgba(32, 184, 205, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20B8CD',
  },
  aiText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#E5E7EB',
  },
  definitionText: {
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
  bookContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  bookCover: {
    width: 80,
    height: 120,
    borderRadius: 8,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#20B8CD',
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  bookMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
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
    marginBottom: 12,
  },
  genreText: {
    fontSize: 11,
    color: '#20B8CD',
    fontWeight: '500',
  },
  bookDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9CA3AF',
  },
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
  definitionSection: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  definitionContent: {
    gap: 0,
  },
  definitionTerm: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20B8CD',
    marginBottom: 4,
    fontFamily: 'Times New Roman',
    fontStyle: 'italic',
  },
  emptyBlockContainer: {
    backgroundColor: 'rgba(32, 184, 205, 0.05)',
    borderWidth: 1,
    borderColor: '#20B8CD',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  emptyBlockText: {
    color: '#20B8CD',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBlockSubtext: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
  },
  editSelectionButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  editSelectionText: {
    color: '#20B8CD',
    fontSize: 12,
    fontWeight: '500',
  },
  definitionGenre: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  definitionDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#E5E7EB',
    marginBottom: 8,
  },
  definitionExample: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  exampleLabel: {
    fontStyle: 'italic',
    color: '#6B7280',
  },
  definitionDivider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginVertical: 12,
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
  gridSection: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBlockModal: {
    width: '80%',
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  addBlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  addBlockOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F1F1F',
    marginBottom: 8,
    backgroundColor: '#1A1A1A',
  },
  addBlockOptionText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  gridCard: {
    backgroundColor: '#36877F',
    height: 80,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCardText: {
    color: '#FFFFFF',
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
