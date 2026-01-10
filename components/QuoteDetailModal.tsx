import React, { useCallback, useMemo } from 'react';
import {
  View,
  Share,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { X, Calendar, User as UserIcon, Sparkles, BookOpen, Heart, Share2, Plus } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import type { SortableGridRenderItem } from 'react-native-sortables';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Sortable from 'react-native-sortables';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import AddBlockModal from './AddBlockModal';
import { useData } from '../src/contexts/DataProvider';
import { Quote, Book, Author } from '../types';
import { getBookTitle, getAuthorName } from '../src/utils/dataHelpers';
import { formatRelativeDate } from '../src/utils/dateUtils';
import WordSelectionModal from './WordSelectionModal';
import { fetchDefinition } from '../src/services/WiktionaryService';
import { authorService } from '../src/services/AuthorService';
import { quoteService } from '../src/services/QuoteService';
import { BlockDispatcher, BlockContext } from './blocks/BlockDispatcher';
import { QUOTE_DETAIL_BLOCK_OPTIONS, BLOCK_CONFIGS } from '../src/config/blocks';
import { useTheme } from '../src/contexts/ThemeContext';
import { ThemeColors } from '../src/theme/theme';

export function QuoteDetailModal() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: { quote: Quote } }, 'params'>>();
  const { quote: initialQuote } = route.params ?? {};
  const { quotes, getBlockLayout, updateBlockLayout, updateQuote, toggleLikeQuote } = useData();

  // Sync with global store to get latest data (e.g. user info)
  const globalQuote = quotes.find(q => q.id === initialQuote?.id);
  const [quote, setQuote] = React.useState(globalQuote || initialQuote);

  // State for rich data
  const [fetchedBook, setFetchedBook] = React.useState<Book | null>(null);
  const [fetchedAuthor, setFetchedAuthor] = React.useState<Author | null>(null);
  const [gridData, setGridData] = React.useState<string[]>([]);
  const [isLoadingLayout, setIsLoadingLayout] = React.useState(true);

  React.useEffect(() => {
    if (globalQuote) {
      setQuote(globalQuote);
    }
  }, [globalQuote]);

  React.useEffect(() => {
    const loadData = async () => {
      if (quote) {
        // If user is missing, try to fetch the full quote details freshly
        if (!quote.user && quote.id) {
          try {
            const freshQuote = await quoteService.getQuoteById(quote.id);
            if (freshQuote && freshQuote.user) {
              setQuote(freshQuote);
              return; // Return to avoid double fetching book/author immediately, let the effect re-run
            }
          } catch (e) {
            console.log('Failed to refresh quote details', e);
          }
        }

        const bookTitle = getBookTitle(quote.book);
        const authorName = getAuthorName(quote.author);

        // Fetch rich data using services
        const book = await authorService.getBookByTitle(bookTitle);
        setFetchedBook(book || null);

        const author = await authorService.getAuthorByName(authorName);
        setFetchedAuthor(author || null);
      }
    };
    loadData();
  }, [quote?.id, quote?.user]); // Add quote.user to dependency to verify transition

  const quoteAuthorName = quote ? getAuthorName(quote.author) : '';
  const quoteBookTitle = quote ? getBookTitle(quote.book) : '';

  // Data helpers based on fetched state
  const aiInterpretation = quote?.aiInterpretation || "Cette citation nous invite à réfléchir sur notre condition humaine et nos aspirations.";
  const quoteTheme = quote?.theme || 'Thème non renseigné';

  // Tab Logic
  type TabType = 'description' | 'my_sheet';
  const [activeTab, setActiveTab] = React.useState<TabType>('description');

  const DESCRIPTION_BLOCKS = ['bookInfo', 'author', 'similarBooks', 'similarAuthors'];
  const MYSHEET_BLOCKS = ['definition', 'notes'];

  const blockOptions = QUOTE_DETAIL_BLOCK_OPTIONS.map(key => ({
    key,
    label: BLOCK_CONFIGS[key].label
  }));

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

  const handleUpdateBlockData = (blockId: string, data: any) => {
    setQuote(current => {
      if (!current) return current;
      const newBlockData = { ...current.blockData, [blockId]: data };
      return { ...current, blockData: newBlockData };
    });
  };

  if (!quote) return null;

  const onClose = () => navigation.goBack();

  // Helper for Dispatcher Context
  const getBlockContext = (): BlockContext => ({
    quote,
    book: fetchedBook,
    author: fetchedAuthor,
    onUpdateBlockData: handleUpdateBlockData,
    onBookPress: (title) => navigation.navigate('BookDetail', { bookTitle: title }),
    onAuthorPress: (name) => navigation.navigate('AuthorDetail', { authorName: name }),
    onEditDefinitionSelection: (blockId) => {
      setCurrentDefinitionBlockId(blockId);
      setWordSelectionModalVisible(true);
    },
  });

  const blockContext = getBlockContext();

  const handleToggleLike = () => {
    setQuote(currentQuote => {
      if (!currentQuote) return currentQuote;
      return { ...currentQuote, isLiked: !currentQuote.isLiked, likesCount: currentQuote.isLiked ? currentQuote.likesCount - 1 : currentQuote.likesCount + 1 };
    });
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

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  // State and helpers for "Ajouter un bloc"
  const [isAddBlockModalVisible, setAddBlockModalVisible] = React.useState(false);
  const [isWordSelectionModalVisible, setWordSelectionModalVisible] = React.useState(false);
  const [currentDefinitionBlockId, setCurrentDefinitionBlockId] = React.useState<string | null>(null);

  const handleWordsSelected = async (words: string[]) => {
    if (!currentDefinitionBlockId) return;

    const newDefinitions = [];
    for (const word of words) {
      const def = await fetchDefinition(word);
      if (def) {
        newDefinitions.push(def);
      } else {
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

  const renderGridItem = useCallback<SortableGridRenderItem<string>>(({ item }) => {
    if (item === 'addBlock') {
      return (
        <TouchableOpacity style={styles.placeholderSection} onPress={openAddBlockModal}>
          <Plus size={20} color={colors.textTertiary} style={styles.placeholderIcon} />
          <Text style={styles.placeholderText}>Ajouter un bloc</Text>
        </TouchableOpacity>
      );
    }

    return (
      <BlockDispatcher
        blockId={item}
        context={blockContext}
        onRemove={() => handleRemoveBlock(item)}
      />
    );
  }, [blockContext, handleRemoveBlock, colors, styles]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.modalView}>
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
              <X size={24} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          {/* Quote Section */}
          <View style={styles.section}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                fill={colors.primary}
                opacity={0.2}
              />
            </Svg>
            <Text style={styles.quoteText}>{quote.text}</Text>

            <View style={styles.quoteMetaFooter}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={styles.metaRow} onPress={() => onBookPress(quoteBookTitle)}>
                  <BookOpen size={16} color={colors.textTertiary} />
                  <Text style={styles.metaTextBook}>{quoteBookTitle}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.metaRow} onPress={() => onAuthorPress(quoteAuthorName)}>
                  <UserIcon size={16} color={colors.textTertiary} />
                  <Text style={styles.metaTextAuthor}>{quoteAuthorName}</Text>
                </TouchableOpacity>

                {quote.user && (
                  <TouchableOpacity style={styles.metaRow} onPress={() => navigation.navigate('UserProfile', { user: quote.user })}>
                    <Image
                      source={{ uri: quote.user.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }}
                      style={styles.publisherAvatar}
                    />
                    <Text style={styles.metaTextPublisher}>Publié par <Text style={styles.publisherUsername}>{quote.user.username.startsWith('@') ? quote.user.username : '@' + quote.user.username}</Text></Text>
                  </TouchableOpacity>
                )}

                {quote.date && (
                  <View style={styles.metaRow}>
                    <Calendar size={16} color={colors.textTertiary} />
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
                color={quote.isLiked ? colors.primary : colors.textTertiary}
                fill={quote.isLiked ? colors.primary : 'none'}
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
              <Share2 size={20} color={colors.textTertiary} />
              <Text style={styles.actionText}>Partager</Text>
            </TouchableOpacity>
          </View>

          {/* AI Interpretation */}
          <View style={styles.aiSection}>
            <View style={styles.aiHeader}>
              <Sparkles size={16} color={colors.primary} />
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

          {/* Tab Content */}
          <View style={styles.gridSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {activeTab === 'description' ? 'Détails' : 'Mon espace personnel'}
              </Text>
            </View>

            {activeTab === 'description' ? (
              <View style={{ gap: 10 }}>
                {DESCRIPTION_BLOCKS.map(blockKey => (
                  <BlockDispatcher
                    key={blockKey}
                    blockId={blockKey}
                    context={blockContext}
                  />
                ))}
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
                    const newSubOrder = [...currentTabBlocks];
                    const [moved] = newSubOrder.splice(fromIndex, 1);
                    newSubOrder.splice(toIndex, 0, moved);

                    const newMasterList: string[] = [];
                    let subIndex = 0;
                    for (const item of gridData) {
                      if (isBlockInTab(item, activeTab)) {
                        if (subIndex < newSubOrder.length) {
                          newMasterList.push(newSubOrder[subIndex]);
                          subIndex++;
                        }
                      } else {
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  modalView: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: Dimensions.get('window').height * 0.9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHighlight,
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
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  quoteMetaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHighlight,
    gap: 8
  },
  themeBadgeIA: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    marginLeft: 12,
  },
  themeBadgeValue: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  quoteText: {
    fontSize: 24,
    lineHeight: 36,
    color: colors.text,
    marginVertical: 12,
    fontFamily: 'Times New Roman',
    fontStyle: 'italic',
    fontWeight: '100'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metaTextBook: {
    color: colors.primary,
    fontSize: 13,
  },
  metaTextAuthor: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  metaTextDate: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  publisherAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
  },
  metaTextPublisher: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  publisherUsername: {
    color: colors.text,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionTextActive: {
    color: colors.primary,
  },
  aiSection: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryLight,
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
    color: colors.primary,
  },
  aiText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
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
    color: colors.text,
  },
  placeholderSection: {
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  placeholderIcon: {
    marginBottom: 8,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  gridSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.text,
    fontWeight: '600',
  },
});
