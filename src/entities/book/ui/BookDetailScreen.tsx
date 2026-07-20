import { useTheme } from '@/src/app/providers/ThemeContext';
import BookDictionaryModal from '@/src/shared/ui/modals/BookDictionaryModal';
import AddBlockModal from '@/src/shared/ui/modals/AddBlockModal';
import ResourceSearchModal from '@/src/shared/ui/modals/ResourceSearchModal';
import { getAuthorName } from '@/src/shared/lib/dataHelpers';
import { BlockDispatcher } from '@/src/shared/ui/blocks/BlockDispatcher';
import { BookCover } from '@/src/shared/ui/BookCover';
import { BookOpen, Calendar, Check, ChevronLeft, Info, Plus, Share as ShareIcon, Star } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { Keyboard, RefreshControl, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { NotesKeyboardToolbar, useKeyboardToolbar } from '@/src/shared/ui/blocks/NotesBlock';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sortable from 'react-native-sortables';
import { useHaptics } from '@/src/shared/platform';
import { createStyles } from './BookDetail.styles';
import { BookDetailSkeleton } from './BookDetailSkeleton';
import { useBookDetailController } from './useBookDetailController';

export default function BookDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const haptics = useHaptics();
  
  const {
    router,
    navigateToAuthor,
    bookTitle,
    bookInfo,
    isLoadingMetadata,
    activeTab,
    setActiveTab,
    currentTabBlocks,
    scrollableRef,
    isSaved,
    handleHeaderSavePress,
    handleOpenStatusMenuWithId,
    handleShare,
    handleRemoveBlock,
    handleOrderChange,
    openAddBlockModal,
    isAddBlockModalVisible,
    closeAddBlockModal,
    handleAddBlock,
    filteredBlockOptions,
    isDictionaryModalVisible,
    setDictionaryModalVisible,
    aggregatedDefinitions,
    hiddenTerms,
    manualDefinitions,
    handleUpdateBlockData,
    isResourceSearchModalVisible,
    setResourceSearchModalVisible,
    setCurrentConnectionBlockId,
    handleResourceSelected,
    blockContext,
    getStatusColor,
    getStatusLabel,
    DESCRIPTION_BLOCKS,
    renderQuoteModals,
    reloadBookData,
  } = useBookDetailController();

  const { isNotesFocused, setIsNotesFocused, notesEditorRef, keyboardHeight } = useKeyboardToolbar();

  const augmentedBlockContext = useMemo(() => ({
    ...blockContext,
    notesEditorRef,
    onNotesFocusChange: setIsNotesFocused,
  }), [blockContext, notesEditorRef, setIsNotesFocused]);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadBookData();
    } catch (err) {
      console.error('[BookDetail] Failed to refresh book data:', err);
    } finally {
      setRefreshing(false);
    }
  }, [reloadBookData]);

  const renderGridItem = useCallback(({ item }: { item: string }) => (
    <BlockDispatcher
      blockId={item}
      context={augmentedBlockContext}
      onRemove={() => handleRemoveBlock(item)}
    />
  ), [augmentedBlockContext, handleRemoveBlock]);

  if (isLoadingMetadata) {
    return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="clip">
                {bookTitle || "Chargement..."}
              </Text>
              <View style={styles.fadeOverlayContainer} pointerEvents="none">
                <Svg width={32} height="100%">
                  <Defs>
                    <LinearGradient id="loadingHeaderTitleFade" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
                      <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
                    </LinearGradient>
                  </Defs>
                  <Rect width={32} height="100%" fill="url(#loadingHeaderTitleFade)" />
                </Svg>
              </View>
            </View>
            <View style={styles.saveButton} />
          </View>
          <BookDetailSkeleton colors={colors} />
        </View>
      </SafeAreaView>
    );
  }

  if (!bookTitle) {
    return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Aucun livre spécifié.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bookInfo) {
    return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="clip">
                {bookTitle}
              </Text>
              <View style={styles.fadeOverlayContainer} pointerEvents="none">
                <Svg width={32} height="100%">
                  <Defs>
                    <LinearGradient id="errorHeaderTitleFade" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
                      <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
                    </LinearGradient>
                  </Defs>
                  <Rect width={32} height="100%" fill="url(#errorHeaderTitleFade)" />
                </Svg>
              </View>
            </View>
            <View style={styles.saveButton} />
          </View>
          <Text style={styles.errorText}>Livre non trouvé sur le serveur.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const averageRating = bookInfo.rating ? bookInfo.rating.toFixed(1) : "N/A";

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="clip">
              {bookTitle}
            </Text>
            <View style={styles.fadeOverlayContainer} pointerEvents="none">
              <Svg width={32} height="100%">
                <Defs>
                  <LinearGradient id="headerTitleFade" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
                    <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
                  </LinearGradient>
                </Defs>
                <Rect width={32} height="100%" fill="url(#headerTitleFade)" />
              </Svg>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
              <ShareIcon size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleHeaderSavePress}>
              {isSaved ? <Check size={24} color={colors.primary} /> : <Plus size={24} color={colors.text} />}
            </TouchableOpacity>
          </View>
        </View>

        {bookInfo.isVerified === false && (
          <View style={styles.unverifiedBanner}>
            <Info size={14} color={colors.primary} />
            <Text style={styles.unverifiedBannerText}>
              {"Ce livre n'est pas encore vérifié."}
            </Text>
          </View>
        )}

        <Animated.ScrollView
          ref={scrollableRef}
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: 32 + (isNotesFocused ? 64 : 0) }
          ]}
          contentInset={{ bottom: keyboardHeight + (isNotesFocused ? 64 : 0) }}
          scrollIndicatorInsets={{ bottom: keyboardHeight + (isNotesFocused ? 64 : 0) }}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={false}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1 }}>
              <View style={styles.section}>
            <View style={styles.bookContainer}>
              <BookCover
                uri={bookInfo.cover}
                title={bookTitle}
                width={100}
                height={150}
                borderRadius={8}
                showTitleFallback={true}
                fallbackIcon="book"
                style={styles.bookCoverImage}
              />
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitleText}>{bookTitle}</Text>
                <TouchableOpacity
                  disabled={!bookInfo?.author || getAuthorName(bookInfo?.author) === "Auteur inconnu"}
                  onPress={() => {
                    const authorName = getAuthorName(bookInfo?.author);
                    const inventaireUri = typeof bookInfo?.author === 'object' && bookInfo?.author !== null ? (bookInfo?.author as any).inventaireUri : undefined;
                    navigateToAuthor(authorName, inventaireUri);
                  }}
                >
                  <Text style={styles.bookAuthorText}>{getAuthorName(bookInfo?.author)}</Text>
                </TouchableOpacity>

                <View style={styles.bookMeta}>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{bookInfo.year}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <BookOpen size={14} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{bookInfo.pages} p.</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Star size={14} color={colors.primary} fill={colors.primary} />
                    <Text style={styles.metaText}>{averageRating}/5</Text>
                  </View>
                </View>

                <View style={styles.badgeContainer}>
                  {bookInfo.genre && bookInfo.genre !== 'Unknown' && bookInfo.genre !== '' && (
                    <View style={styles.genreBadge}>
                      <Text style={styles.genreText}>{bookInfo.genre}</Text>
                    </View>
                  )}

                  {bookInfo.readingStatus && (
                    <TouchableOpacity
                      style={[styles.statusBadge, {
                        backgroundColor: getStatusColor(bookInfo.readingStatus) + '15',
                        borderColor: getStatusColor(bookInfo.readingStatus) + '40'
                      }]}
                      onLongPress={async () => {
                        if (bookInfo.id) {
                          try {
                            await haptics.impactAsync('medium');
                          } catch (err) {
                            console.warn('Haptics failed', err);
                          }
                          handleOpenStatusMenuWithId(bookInfo.id);
                        }
                      }}
                      delayLongPress={400}
                    >
                      <Text style={[styles.statusText, { color: getStatusColor(bookInfo.readingStatus) }]}>
                        {getStatusLabel(bookInfo.readingStatus)}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {bookInfo.laureates?.map(laureate => (
                    <TouchableOpacity
                      key={`prize-${laureate.id}`}
                      onPress={() => {
                        // Navigate to prize if available
                      }}
                      style={[styles.statusBadge, {
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        borderColor: 'rgba(239, 68, 68, 0.4)'
                      }]}
                    >
                      <Text style={[styles.statusText, { color: '#EF4444' }]}>
                        {laureate.prizeName} {laureate.year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "description" && styles.activeTabButton]}
              onPress={() => setActiveTab("description")}
            >
              <Text style={[styles.tabText, activeTab === "description" && styles.activeTabText]}>Description</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "my_sheet" && styles.activeTabButton]}
              onPress={() => setActiveTab("my_sheet")}
            >
              <Text style={[styles.tabText, activeTab === "my_sheet" && styles.activeTabText]}>Ma fiche</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gridSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {activeTab === "description" ? "Détails du livre" : "Mon espace personnel"}
              </Text>
            </View>
            {activeTab === "description" ? (
              <View style={{ gap: 6 }}>
                {DESCRIPTION_BLOCKS.map(blockKey => (
                  <BlockDispatcher
                    key={blockKey}
                    blockId={blockKey}
                    context={augmentedBlockContext}
                  />
                ))}
              </View>
            ) : (
              <>
                <Sortable.Grid
                  columns={1}
                  data={currentTabBlocks}
                  renderItem={renderGridItem as any}
                  rowGap={6}
                  columnGap={6}
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
                <AddBlockModal
                  visible={isAddBlockModalVisible}
                  onClose={closeAddBlockModal}
                  onSelect={handleAddBlock}
                  options={filteredBlockOptions as any}
                />
              </>
            )}
          </View>
          </View>
          </TouchableWithoutFeedback>
        </Animated.ScrollView>

        <NotesKeyboardToolbar
          isNotesFocused={isNotesFocused}
          keyboardHeight={keyboardHeight}
          notesEditorRef={notesEditorRef}
        />

        <BookDictionaryModal
          visible={isDictionaryModalVisible}
          onClose={() => setDictionaryModalVisible(false)}
          availableDefinitions={aggregatedDefinitions || []}
          hiddenTerms={(hiddenTerms || []) as string[]}
          currentManualDefinitions={manualDefinitions || []}
          onUpdate={(newManuals, newHidden) => {
            handleUpdateBlockData('dictionary', { manualDefinitions: newManuals, hiddenTerms: newHidden });
          }}
        />

        <ResourceSearchModal
          visible={isResourceSearchModalVisible}
          onClose={() => {
            setResourceSearchModalVisible(false);
            setCurrentConnectionBlockId(null);
          }}
          onSelect={handleResourceSelected}
        />

        {renderQuoteModals()}
      </View>
    </SafeAreaView>
  );
}
