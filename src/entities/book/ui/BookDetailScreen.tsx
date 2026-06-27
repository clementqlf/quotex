import { useTheme } from '@/src/app/providers/ThemeContext';
import BookDictionaryModal from '@/src/shared/ui/modals/BookDictionaryModal';
import AddBlockModal from '@/src/shared/ui/modals/AddBlockModal';
import ResourceSearchModal from '@/src/shared/ui/modals/ResourceSearchModal';
import { getAuthorName } from '@/src/shared/lib/dataHelpers';
import { BlockDispatcher } from '@/src/shared/ui/blocks/BlockDispatcher';
import { Image } from 'expo-image';
import { BookOpen, Calendar, Check, ChevronLeft, Info, Plus, Share as ShareIcon, Star } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
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
  } = useBookDetailController();

  const renderGridItem = useCallback(({ item }: { item: string }) => (
    <BlockDispatcher
      blockId={item}
      context={blockContext}
      onRemove={() => handleRemoveBlock(item)}
    />
  ), [blockContext, handleRemoveBlock]);

  if (isLoadingMetadata) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle || "Chargement..."}</Text>
            <View style={styles.saveButton} />
          </View>
          <BookDetailSkeleton colors={colors} />
        </View>
      </SafeAreaView>
    );
  }

  if (!bookTitle) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Aucun livre spécifié.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bookInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{bookTitle}</Text>
            <View style={styles.saveButton} />
          </View>
          <Text style={styles.errorText}>Livre non trouvé sur le serveur.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const averageRating = bookInfo.rating ? bookInfo.rating.toFixed(1) : "N/A";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
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
              Ce livre n'est pas encore vérifié.
            </Text>
          </View>
        )}

        <Animated.ScrollView
          ref={scrollableRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.bookContainer}>
              <Image source={{ uri: bookInfo.cover }} style={styles.bookCoverImage} />
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
                  renderItem={renderGridItem as any}
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
                <AddBlockModal
                  visible={isAddBlockModalVisible}
                  onClose={closeAddBlockModal}
                  onSelect={handleAddBlock}
                  options={filteredBlockOptions as any}
                />
              </>
            )}
          </View>
        </Animated.ScrollView>

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
