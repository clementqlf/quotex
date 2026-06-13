import { useTheme } from '@/src/app/providers/ThemeContext';
import BookDictionaryModal from '@/src/features/dictionary/ui/BookDictionaryModal';
import AddBlockModal from '@/src/features/edit-book/ui/AddBlockModal';
import ResourceSearchModal from '@/src/features/search/ui/ResourceSearchModal';
import { getAuthorName } from '@/src/shared/lib/dataHelpers';
import { BlockDispatcher } from '@/src/shared/ui/blocks/BlockDispatcher';
import { Image } from 'expo-image';
import { BookOpen, Calendar, Check, ChevronLeft, Plus, Share as ShareIcon, Star } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sortable from 'react-native-sortables';
import { createStyles } from './BookDetail.styles';
import { BookDetailSkeleton } from './BookDetailSkeleton';
import { useBookDetailController } from './useBookDetailController';

export default function BookDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const controller = useBookDetailController();

  const renderGridItem = useCallback(({ item }: { item: string }) => (
    <BlockDispatcher
      blockId={item}
      context={controller.blockContext}
      onRemove={() => controller.handleRemoveBlock(item)}
    />
  ), [controller]);

  if (controller.isLoadingMetadata) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => controller.router.back()}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{controller.bookTitle || "Chargement..."}</Text>
            <View style={styles.saveButton} />
          </View>
          <BookDetailSkeleton colors={colors} />
        </View>
      </SafeAreaView>
    );
  }

  if (!controller.bookTitle) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Aucun livre spécifié.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!controller.bookInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => controller.router.back()}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{controller.bookTitle}</Text>
            <View style={styles.saveButton} />
          </View>
          <Text style={styles.errorText}>Livre non trouvé sur le serveur.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const averageRating = controller.bookInfo.rating ? controller.bookInfo.rating.toFixed(1) : "N/A";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => controller.router.back()}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{controller.bookTitle}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={controller.handleShare}>
              <ShareIcon size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={controller.handleHeaderSavePress}>
              {controller.isSaved ? <Check size={24} color={colors.primary} /> : <Plus size={24} color={colors.text} />}
            </TouchableOpacity>
          </View>
        </View>

        <Animated.ScrollView
          ref={controller.scrollableRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.bookContainer}>
              <Image source={{ uri: controller.bookInfo.cover }} style={styles.bookCoverImage} />
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitleText}>{controller.bookTitle}</Text>
                <TouchableOpacity
                  disabled={!controller.bookInfo?.author || getAuthorName(controller.bookInfo?.author) === "Auteur inconnu"}
                  onPress={() => {
                    const authorName = getAuthorName(controller.bookInfo?.author);
                    const inventaireUri = typeof controller.bookInfo?.author === 'object' && controller.bookInfo?.author !== null ? (controller.bookInfo?.author as any).inventaireUri : undefined;
                    controller.navigateToAuthor(authorName, inventaireUri);
                  }}
                >
                  <Text style={styles.bookAuthorText}>{getAuthorName(controller.bookInfo?.author)}</Text>
                </TouchableOpacity>

                <View style={styles.bookMeta}>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{controller.bookInfo.year}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <BookOpen size={14} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{controller.bookInfo.pages} p.</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Star size={14} color={colors.primary} fill={colors.primary} />
                    <Text style={styles.metaText}>{averageRating}/5</Text>
                  </View>
                </View>

                <View style={styles.badgeContainer}>
                  {controller.bookInfo.genre && controller.bookInfo.genre !== 'Unknown' && controller.bookInfo.genre !== '' && (
                    <View style={styles.genreBadge}>
                      <Text style={styles.genreText}>{controller.bookInfo.genre}</Text>
                    </View>
                  )}

                  {controller.bookInfo.readingStatus && (
                    <View style={[styles.statusBadge, {
                      backgroundColor: controller.getStatusColor(controller.bookInfo.readingStatus) + '15',
                      borderColor: controller.getStatusColor(controller.bookInfo.readingStatus) + '40'
                    }]}>
                      <Text style={[styles.statusText, { color: controller.getStatusColor(controller.bookInfo.readingStatus) }]}>
                        {controller.getStatusLabel(controller.bookInfo.readingStatus)}
                      </Text>
                    </View>
                  )}

                  {controller.bookInfo.laureates?.map(laureate => (
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
              style={[styles.tabButton, controller.activeTab === "description" && styles.activeTabButton]}
              onPress={() => controller.setActiveTab("description")}
            >
              <Text style={[styles.tabText, controller.activeTab === "description" && styles.activeTabText]}>Description</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, controller.activeTab === "my_sheet" && styles.activeTabButton]}
              onPress={() => controller.setActiveTab("my_sheet")}
            >
              <Text style={[styles.tabText, controller.activeTab === "my_sheet" && styles.activeTabText]}>Ma fiche</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gridSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {controller.activeTab === "description" ? "Détails du livre" : "Mon espace personnel"}
              </Text>
            </View>
            {controller.activeTab === "description" ? (
              <View style={{ gap: 10 }}>
                {controller.DESCRIPTION_BLOCKS.map(blockKey => (
                  <BlockDispatcher
                    key={blockKey}
                    blockId={blockKey}
                    context={controller.blockContext}
                  />
                ))}
              </View>
            ) : (
              <>
                <Sortable.Grid
                  columns={1}
                  data={controller.currentTabBlocks}
                  renderItem={renderGridItem as any}
                  rowGap={10}
                  columnGap={10}
                  scrollableRef={controller.scrollableRef}
                  autoScrollEnabled={true}
                  autoScrollActivationOffset={75}
                  onOrderChange={(params) => {
                    const { fromIndex, toIndex } = params as { fromIndex: number; toIndex: number };
                    controller.handleOrderChange(fromIndex, toIndex);
                  }}
                />
                <TouchableOpacity style={styles.placeholderSection} onPress={controller.openAddBlockModal}>
                  <Plus size={20} color="#9CA3AF" style={styles.placeholderIcon} />
                  <Text style={styles.placeholderText}>Ajouter un bloc</Text>
                </TouchableOpacity>
                <AddBlockModal
                  visible={controller.isAddBlockModalVisible}
                  onClose={controller.closeAddBlockModal}
                  onSelect={controller.handleAddBlock}
                  options={controller.filteredBlockOptions as any}
                />
              </>
            )}
          </View>
        </Animated.ScrollView>

        <BookDictionaryModal
          visible={controller.isDictionaryModalVisible}
          onClose={() => controller.setDictionaryModalVisible(false)}
          availableDefinitions={controller.aggregatedDefinitions || []}
          hiddenTerms={(controller.hiddenTerms || []) as string[]}
          currentManualDefinitions={controller.manualDefinitions || []}
          onUpdate={(newManuals, newHidden) => {
            controller.handleUpdateBlockData('dictionary', { manualDefinitions: newManuals, hiddenTerms: newHidden });
          }}
        />

        <ResourceSearchModal
          visible={controller.isResourceSearchModalVisible}
          onClose={() => {
            controller.setResourceSearchModalVisible(false);
            controller.setCurrentConnectionBlockId(null);
          }}
          onSelect={controller.handleResourceSelected}
        />
      </View>
    </SafeAreaView>
  );
}
