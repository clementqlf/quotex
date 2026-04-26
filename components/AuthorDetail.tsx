import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSmartNavigation } from '@/src/hooks/useSmartNavigation';
import { ChevronLeft, BookOpen, User, Calendar, Globe, Heart, X, Bookmark } from 'lucide-react-native';
import { useData } from '@/src/contexts/DataProvider';
import { getBookTitle } from '@/src/utils/dataHelpers';
import { Author, Book } from '@/types';
import { useTheme } from '@/src/contexts/ThemeContext';
import { ThemeColors } from '@/src/theme/theme';

export function AuthorDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { navigateToBook, navigateToAuthor } = useSmartNavigation();
  const params = useLocalSearchParams<{ author?: string; authorName?: string }>();
  const author: Author | undefined = params.author ? JSON.parse(params.author as string) : undefined;
  const paramAuthorName = params.authorName;
  const nameToUse = author?.name || paramAuthorName;

  const { quotes, getBooksByAuthor, getAuthorByName, toggleLikeQuote, toggleSaveAuthor, getNotableWorks } = useData();
  const [authorInfo, setAuthorInfo] = React.useState<Author | null>(author || null);
  const [authorBooks, setAuthorBooks] = React.useState<Book[]>([]);
  const [isLoadingAuthor, setIsLoadingAuthor] = React.useState(true);

  // New state for All Works Modal
  const [showAllWorksModal, setShowAllWorksModal] = React.useState(false);
  const [allWorks, setAllWorks] = React.useState<Book[]>([]);
  const [isLoadingAllWorks, setIsLoadingAllWorks] = React.useState(false);

  React.useEffect(() => {
    async function loadAuthorData() {
      if (!nameToUse) return;

      setIsLoadingAuthor(true);
      try {
        const currentAuthorId = authorInfo?.id;
        const needsFetch = !authorInfo || !currentAuthorId;

        console.log(`[AuthorDetail] Loading data for: ${nameToUse}`);

        const [internalBooks, fetchedAuthor, wikiBooks] = await Promise.all([
          getBooksByAuthor(nameToUse, currentAuthorId),
          needsFetch ? getAuthorByName(nameToUse) : Promise.resolve(null),
          currentAuthorId ? getNotableWorks(currentAuthorId) : Promise.resolve([])
        ]);

        const booksToDisplay = wikiBooks.length > 0 ? wikiBooks : internalBooks;

        if (fetchedAuthor) {
          setAuthorInfo(fetchedAuthor);
        }

        setAuthorBooks(booksToDisplay);

      } catch (error) {
        console.error("Error loading author data:", error);
      } finally {
        setIsLoadingAuthor(false);
      }
    }
    loadAuthorData();
  }, [nameToUse, authorInfo?.id, getBooksByAuthor, getAuthorByName]);

  const fetchAllWorks = async () => {
    if (!nameToUse) return;
    if (allWorks.length > 0) {
      setShowAllWorksModal(true);
      return;
    }

    setIsLoadingAllWorks(true);
    setShowAllWorksModal(true);
    try {
      // For now, "All Works" still uses external service or we could also move it to backend
      // Using existing backend enrichment logic for consistency
      const currentAuthorId = authorInfo?.id;
      if (!currentAuthorId) throw new Error("Artist ID missing");
      const works = await getBooksByAuthor(nameToUse, currentAuthorId);
      setAllWorks(works);
    } catch (error) {
      console.error("Error fetching all works:", error);
    } finally {
      setIsLoadingAllWorks(false);
    }
  };

  const authorName = authorInfo?.name || nameToUse || 'Inconnu';
  const authorDesc = authorInfo?.description || `${authorName} est un auteur reconnu.`;
  const authorImage = authorInfo?.image || 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=400&h=400&fit=crop';

  const totalQuotes = useMemo(() => quotes.filter(q =>
    typeof q.author === 'string' ? q.author === authorName : q.author?.name === authorName
  ).length, [quotes, authorName]);

  const userQuotesCount = useMemo(() => quotes.filter(q => {
    const isMyQuote = q.user?.id == 1 || !q.user;
    if (!isMyQuote) return false;
    const qAuthorName = typeof q.author === 'string' ? q.author : q.author?.name;
    return qAuthorName === authorName;
  }).length, [quotes, authorName]);

  const isSaved = authorInfo?.isSaved || userQuotesCount > 0;
  const canToggleSave = userQuotesCount === 0;

  const handleToggleSave = async () => {
    if (!canToggleSave || !authorInfo?.id) return;
    await toggleSaveAuthor(authorInfo.id);
    // Refresh local state
    setAuthorInfo(prev => prev ? { ...prev, isSaved: !prev.isSaved } : null);
  };

  if (isLoadingAuthor) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 16 }}>Chargement des informations...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{authorName}</Text>
          <TouchableOpacity
            style={[styles.saveButton, !canToggleSave && { opacity: 0.8 }]}
            onPress={handleToggleSave}
            disabled={!canToggleSave}
          >
            <Bookmark
              size={24}
              color={isSaved ? colors.primary : colors.text}
              fill={isSaved ? colors.primary : 'none'}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHeader}>
            <Image source={{ uri: authorImage }} style={styles.authorImage} />
            <Text style={styles.authorName}>{authorName}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
            </View>
            <Text style={styles.authorDesc}>{authorDesc}</Text>
          </View>

          <View style={styles.detailContainerSection}>
            <View style={styles.detailsContainer}>
              <View style={styles.detailItem}>
                <Calendar size={16} color={colors.textTertiary} />
                <Text style={styles.detailLabel}>Naissance</Text>
                <Text style={styles.detailValue}>{authorInfo?.birthDate || 'Inconnu'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Globe size={16} color={colors.textTertiary} />
                <Text style={styles.detailLabel}>Nationalité</Text>
                <Text style={styles.detailValue}>{authorInfo?.nationality || 'Inconnue'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{authorBooks.length}</Text>
              <Text style={styles.statLabel}>Œuvres Notables</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalQuotes}</Text>
              <Text style={styles.statLabel}>Citations</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Œuvres Notables</Text>
            </View>

            {authorBooks.length === 0 && !isLoadingAuthor && (
              <Text style={styles.emptyText}>Aucune œuvre notable trouvée.</Text>
            )}

            {authorBooks.map((book, index) => (
              <TouchableOpacity
                key={`${book.id || book.title}-${index}`}
                style={styles.bookItem}
                onPress={() => navigateToBook(book.title)}>
                <View style={styles.bookCoverContainer}>
                  {book.cover ? (
                    <Image source={{ uri: book.cover }} style={styles.bookCover} />
                  ) : (
                    <View style={[styles.bookCover, styles.bookCoverPlaceholder]}>
                      <BookOpen size={20} color={colors.textTertiary} />
                    </View>
                  )}
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
                  {book.year > 0 && (
                    <Text style={styles.bookMetaText}>{book.year}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.showAllButton}
              onPress={fetchAllWorks}
            >
              <Text style={styles.showAllButtonText}>Afficher toutes les œuvres</Text>
            </TouchableOpacity>
          </View>

          {(() => {
            const userQuotes = quotes.filter(q => {
              const isMyQuote = q.user?.id == 1 || !q.user;
              if (!isMyQuote) return false;
              const qAuthorName = typeof q.author === 'string' ? q.author : q.author?.name;
              return qAuthorName === authorName;
            });

            if (userQuotes.length === 0) return null;

            return (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.primary }]}>Mes Citations</Text>
                </View>
                <View style={{ gap: 12 }}>
                  {userQuotes.map((quote) => (
                    <TouchableOpacity
                      key={quote.id}
                      style={styles.quoteCard}
                      activeOpacity={0.85}
                      onPress={() => router.navigate({ pathname: '/quote-detail', params: { quote: JSON.stringify(quote) } })}
                    >
                      <Text style={styles.quoteText}>"{quote.text}"</Text>
                      <View style={styles.quoteMeta}>
                        <View style={styles.quoteMetaLeft}>
                          <Text style={styles.quoteBook}>{getBookTitle(quote.book)}</Text>
                        </View>
                        <View style={styles.quoteMetaRight}>
                          <TouchableOpacity
                            style={styles.likeButton}
                            onPress={() => toggleLikeQuote(quote.id)}
                          >
                            <Heart
                              size={16}
                              color={quote.isLiked ? colors.warning : colors.textTertiary}
                              fill={quote.isLiked ? colors.warning : "none"}
                            />
                            <Text style={styles.likeCount}>{quote.likesCount}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })()}
        </ScrollView>

        <Modal
          visible={showAllWorksModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAllWorksModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Toutes les œuvres</Text>
              <TouchableOpacity onPress={() => setShowAllWorksModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {isLoadingAllWorks ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={allWorks}
                keyExtractor={(item, index) => `${item.id || item.title}-${index}`}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.bookItem}
                    onPress={() => {
                      setShowAllWorksModal(false);
                      navigateToBook(item.title);
                    }}>
                    <View style={styles.bookCoverContainer}>
                      {item.cover ? (
                        <Image source={{ uri: item.cover }} style={styles.bookCover} />
                      ) : (
                        <View style={[styles.bookCover, styles.bookCoverPlaceholder]}>
                          <BookOpen size={20} color={colors.textTertiary} />
                        </View>
                      )}
                    </View>
                    <View style={styles.bookInfo}>
                      <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
                      {item.year > 0 && (
                        <Text style={styles.bookMetaText}>Publié en {item.year}</Text>
                      )}
                      {item.genre ? (
                        <Text style={[styles.bookMetaText, { marginTop: 2 }]} numberOfLines={1}>{item.genre}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1, textAlign: 'center'
  },
  saveButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  authorImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 12,
  },
  authorName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
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
  authorDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  detailContainerSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  detailsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
  },
  bookCoverContainer: {
    marginRight: 16,
  },
  bookCover: {
    width: 60,
    height: 90,
    borderRadius: 6,
    backgroundColor: colors.surfaceHighlight,
  },
  bookCoverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 10,
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  bookMetaText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  quoteCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    padding: 12,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  quoteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quoteMetaLeft: {
    flex: 1,
  },
  quoteBook: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  quoteMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  likeCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  showAllButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  showAllButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});