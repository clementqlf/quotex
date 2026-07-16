import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { Author, Book, ExternalBookResult, ReadingStatus } from '@/src/shared/api/types';
import BookCardItem from '@/src/entities/book/ui/BookCardItem';
import { getAuthorName, getBookTitle, isUserQuote, STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { formatFlexibleDate } from '@/src/shared/lib/dateUtils';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors } from '@/src/shared/theme';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertTriangle, Bookmark, BookOpen, Calendar, ChevronLeft, Globe, Share as ShareIcon, UserCheck, UserPlus, X } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { authorService } from '@/src/entities/author/api/AuthorService';
import { AuthorBlock } from '@/src/shared/ui/blocks/AuthorBlock';
import { SavedQuotesBlock } from '@/src/shared/ui/blocks/SavedQuotesBlock';
import { SimilarBlock } from '@/src/shared/ui/blocks/SimilarBlock';
import { useQuoteCreationFlow } from '@/src/entities/quote/lib';
import { useRealtimeAuthors } from '@/src/shared/lib/hooks/useRealtimeEntity';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export const AuthorSkeleton = ({ colors }: { colors: ThemeColors }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [opacity]);


  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
        <Animated.View style={[{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
        <Animated.View style={[{ width: "50%", height: 26, borderRadius: 4, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
      </View>

      <Animated.View style={[{ width: "100%", height: 120, borderRadius: 16, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
      <Animated.View style={[{ width: "100%", height: 80, borderRadius: 16, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <Animated.View style={[{ flex: 1, height: 80, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
        <Animated.View style={[{ flex: 1, height: 80, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
      </View>

      <Animated.View style={[{ width: "40%", height: 20, borderRadius: 4, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
      <Animated.View style={[{ width: '100%', height: 110, borderRadius: 12, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
      <Animated.View style={[{ width: '100%', height: 110, borderRadius: 12, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
    </View>
  );
};

export default function AuthorDetailScreen() {
  const { user: currentUser } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { navigateToBook, navigateToAuthor, navigateToAuthorWorks } = useSmartNavigation();
  const params = useLocalSearchParams<{ author?: string; authorName?: string; inventaireUri?: string }>();
  const author: Author | undefined = params.author ? JSON.parse(params.author as string) : undefined;
  const paramAuthorName = params.authorName;
  const nameToUse = author?.name || paramAuthorName;

  // Remplacement de useData() par les hooks spécifiques
  const { quotes } = useQuote();
  const { books: allBooks, getBooksByAuthor, getExternalBooksByAuthor, resolveGoogleBook, toggleSaveAuthor, importBook, toggleSaveBook, updateBookStatus } = useAuthor();
  
  // Use TanStack Query for author data
  const authorId = author?.id;
  const authorNameForQuery = nameToUse;
  
  const { data: authorInfo, isLoading: isLoadingAuthorInfo, refetch: refetchAuthor } = useQuery({
    queryKey: ['author', authorId, authorNameForQuery, params.inventaireUri],
    queryFn: () => {
      if (authorId) {
        return authorService.getAuthorById(authorId);
      }
      if (authorNameForQuery) {
        return authorService.getAuthorByName(authorNameForQuery, params.inventaireUri);
      }
      return Promise.resolve(null);
    },
    enabled: !!authorId || !!authorNameForQuery,
    staleTime: 10 * 1000 // 10 seconds to allow rapid background updates to sync
  });
  const resolvedAuthorId = authorInfo?.id || authorId;

  // Use TanStack Query for all works (all books in DB for this author)
  const { data: allWorks = [], isLoading: isLoadingAllWorks, refetch: refetchAllWorks } = useQuery({
    queryKey: ['author-all-works', resolvedAuthorId, nameToUse],
    queryFn: async () => {
      if (!resolvedAuthorId || !nameToUse) throw new Error('Author ID or name missing');
      return getBooksByAuthor(nameToUse, resolvedAuthorId);
    },
    enabled: !!resolvedAuthorId && !!nameToUse,
    staleTime: 30 * 1000 // 30 seconds to be more reactive to database changes
  });

  const { data: authorBooks = [], refetch: refetchBooks } = useQuery({
    queryKey: ['author-books', resolvedAuthorId],
    queryFn: () => {
      if (resolvedAuthorId) {
        return authorService.getNotableWorks(resolvedAuthorId);
      }
      return Promise.resolve([]);
    },
    enabled: !!resolvedAuthorId,
    staleTime: 10 * 1000
  });
  
  // Convert undefined to null for compatibility with existing code
  const resolvedAuthorInfo: Author | null = authorInfo ?? null;
  const resolvedAuthorBooks: Book[] = useMemo(() => authorBooks ?? [], [authorBooks]);
  const notableWorks = useMemo(
    () => {
      const notable = resolvedAuthorBooks.filter((book) => book.isNotable);
      if (notable.length > 0) {
        return notable;
      }
      return allWorks.slice(0, 7);
    },
    [resolvedAuthorBooks, allWorks]
  );

  const enrichingAuthors = useMemo(() => {
    if (!resolvedAuthorInfo) return [];
    const needsEnrichment = !resolvedAuthorInfo.description || resolvedAuthorInfo.description.length < 200 || !resolvedAuthorInfo.image;
    if (needsEnrichment || resolvedAuthorInfo.isEnriching) {
      return [resolvedAuthorInfo];
    }
    return [];
  }, [resolvedAuthorInfo]);

  useRealtimeAuthors(enrichingAuthors, () => {
    console.log('[Realtime] Author updated, refetching details...');
    refetchAuthor();
    refetchBooks();
    refetchAllWorks();
  });
  
  const [isNavigationReady, setIsNavigationReady] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Combine loading states
  const isParamsLoading = !isNavigationReady || (!authorId && !authorNameForQuery);
  const isLoadingAuthor = isLoadingAuthorInfo || isLoadingAllWorks || isParamsLoading;

  // New state for All Quotes Modal
  const [showAllQuotesModal, setShowAllQuotesModal] = React.useState(false);
  const [hasRenderedQuotesModal, setHasRenderedQuotesModal] = React.useState(false);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchAuthor(),
      refetchBooks(),
      refetchAllWorks()
    ]);
    setRefreshing(false);
  }, [refetchAuthor, refetchBooks, refetchAllWorks]);

  // Total books/works count computed during render
  const totalBooksCount = allWorks.length > 0 ? allWorks.length : resolvedAuthorBooks.length;

  const fetchAllWorks = async () => {
    if (!nameToUse) return;
    navigateToAuthorWorks(resolvedAuthorId, nameToUse, params.inventaireUri || author?.inventaireUri);
  };

  const authorName = authorInfo?.name || nameToUse || 'Inconnu';
  const authorImage = authorInfo?.image || 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=400&h=400&fit=crop';



  const authorQuotes = useMemo(() => {
    return quotes.filter(q =>
      getAuthorName(q.author).toLowerCase() === authorName.toLowerCase()
    );
  }, [quotes, authorName]);

  const totalQuotes = authorQuotes.length;

  const userQuotesCount = useMemo(() => quotes.filter(q => {
    return isUserQuote(q, currentUser?.id) && getAuthorName(q.author).toLowerCase() === authorName.toLowerCase();
  }).length, [quotes, authorName, currentUser]);

  const isSaved = resolvedAuthorInfo?.isSaved || userQuotesCount > 0;
  const canToggleSave = userQuotesCount === 0;

  const handleToggleSave = async () => {
    if (!canToggleSave || !resolvedAuthorInfo?.id) return;
    const res = await toggleSaveAuthor(resolvedAuthorInfo.id);
    if (res) {
      // Note: resolvedAuthorInfo comes from useQuery, we can't modify it directly
      // This would require using queryClient.setQueryData
    }
  };

  const handleToggleFollow = async () => {
    if (!resolvedAuthorInfo?.id) return;
    const res = await toggleSaveAuthor(resolvedAuthorInfo.id);
    if (res) {
      // Note: resolvedAuthorInfo comes from useQuery, we can't modify it directly
      // This would require using queryClient.setQueryData
    }
  };

  const handleShare = async () => {
    if (!resolvedAuthorInfo) return;
    try {
      await Share.share({
        message: `Découvrez l'auteur "${authorName}" sur Quotex !`,
      });
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleOpenWikipedia = async () => {
    if (!resolvedAuthorInfo?.inventaireUri || !resolvedAuthorInfo.inventaireUri.startsWith('wd:')) {
      // Fallback: search by name if no URI
      const searchUrl = `https://fr.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(authorName)}`;
      await WebBrowser.openBrowserAsync(searchUrl);
      return;
    }

    const qid = resolvedAuthorInfo.inventaireUri.replace('wd:', '');
    const wikiUrl = `https://www.wikidata.org/wiki/Special:GoToLinkedPage/frwiki/${qid}`;
    await WebBrowser.openBrowserAsync(wikiUrl);
  };

  const { openAddQuoteFlow, renderQuoteModals } = useQuoteCreationFlow({
    initialAuthor: authorName,
  });

  const handleAddBook = async (book: any) => {
    try {
      const localBook = allBooks.find(b => 
        (book.inventaireUri && b.inventaireUri === book.inventaireUri) || 
        (book.googleId && b.googleId === book.googleId) ||
        b.title.toLowerCase() === book.title.toLowerCase()
      );

      let bookIdToSave = localBook?.id;

      if (localBook?.isSaved) {
        const idToUnsave = bookIdToSave;
        if (idToUnsave) {
          const quoteCount = quotes.filter(q => {
            const qBookTitle = getBookTitle(q.book);
            return qBookTitle.toLowerCase() === book.title.toLowerCase();
          }).length;

          const performUnsave = async () => {
            toggleSaveBook(idToUnsave).catch(err => {
              console.error('[AuthorDetail] Optimistic unsave failed:', err);
            });
            Alert.alert('Succès', `Le livre "${book.title}" a été retiré de votre bibliothèque.`);
          };

          if (quoteCount > 0) {
            Alert.alert(
              'Retirer de ma bibliothèque',
              "Retirer ce livre de votre bibliothèque ne supprimera pas vos citations associées. Êtes-vous sûr ?",
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Retirer', style: 'destructive', onPress: performUnsave }
              ]
            );
          } else {
            await performUnsave();
          }
        }
        return;
      }

      if (!bookIdToSave) {
        let googleId = book.googleId;
        let isbn = book.isbn;
        let cover = book.cover;
        let description = book.description;
        let year = book.year;
        let pages = book.pages;

        if (book.isExternal) {
          try {
            const resolved = await resolveGoogleBook(book.title, authorName);
            if (resolved) {
              googleId = resolved.googleId || googleId;
              isbn = resolved.isbn || isbn;
              cover = resolved.cover || cover;
              description = resolved.description || description;
              year = resolved.year || year;
              pages = resolved.pages || pages;
            }
          } catch (e) {
            console.warn('[AuthorDetail] Failed to resolve external book:', e);
          }
        }

        const importPayload = {
          title: book.title,
          cover: cover,
          description: description || '',
          year: year || 0,
          pages: pages || 0,
          genre: book.genre || 'Unknown',
          authors: book.authors || [authorName],
          inventaireUri: book.inventaireUri || (googleId ? `googlebooks:${googleId}` : undefined),
          googleId: googleId,
          isbn: isbn,
        };

        const imported = await importBook(importPayload);
        if (imported && imported.id) {
          bookIdToSave = imported.id;
        } else {
          Alert.alert('Erreur', 'Impossible de créer le livre sur le serveur.');
          return;
        }
      }

      if (bookIdToSave) {
        Promise.all([
          toggleSaveBook(bookIdToSave),
          updateBookStatus(bookIdToSave, 'TO_READ' as ReadingStatus)
        ]).catch(err => {
          console.error('[AuthorDetail] Optimistic update failed:', err);
        });
        Alert.alert('Succès', `Le livre "${book.title}" a été ajouté à votre bibliothèque.`);
      }
    } catch (error) {
      console.error('[AuthorDetail] Failed to toggle book in library:', error);
      Alert.alert('Erreur', "Une erreur est survenue lors de la modification de la bibliothèque.");
    }
  };


  const handleOpenBookStatusMenu = async (book: any) => {
    let bookId = book.id;

    const localBook = allBooks.find(b => 
      (book.inventaireUri && b.inventaireUri === book.inventaireUri) || 
      (book.googleId && b.googleId === book.googleId) ||
      b.title.toLowerCase() === book.title.toLowerCase()
    );

    if (localBook) {
      bookId = localBook.id;
    }

    const options = [...STATUS_OPTIONS];

    const changeStatus = async (status: string) => {
      try {
        if (!bookId) {
          let googleId = book.googleId;
          let isbn = book.isbn;
          let cover = book.cover;
          let description = book.description;
          let year = book.year;
          let pages = book.pages;

          if (book.isExternal) {
            try {
              const resolved = await resolveGoogleBook(book.title, authorName);
              if (resolved) {
                googleId = resolved.googleId || googleId;
                isbn = resolved.isbn || isbn;
                cover = resolved.cover || cover;
                description = resolved.description || description;
                year = resolved.year || year;
                pages = resolved.pages || pages;
              }
            } catch (e) {
              console.warn('[AuthorDetail] Failed to resolve external book:', e);
            }
          }

          const importPayload = {
            title: book.title,
            cover: cover,
            description: description || '',
            year: year || 0,
            pages: pages || 0,
            genre: book.genre || 'Unknown',
            authors: book.authors || [authorName],
            inventaireUri: book.inventaireUri || (googleId ? `googlebooks:${googleId}` : undefined),
            readingStatus: status,
            googleId: googleId,
            isbn: isbn,
          };
          const imported = await importBook(importPayload);
          if (imported && imported.id) {
            Promise.all([
              toggleSaveBook(imported.id),
              updateBookStatus(imported.id, status as ReadingStatus)
            ]).catch(err => {
              console.error('[AuthorDetail] Optimistic update failed:', err);
            });
          } else {
            Alert.alert('Erreur', 'Impossible de créer le livre sur le serveur.');
          }
        } else {
          const promises = [updateBookStatus(bookId, status as ReadingStatus)];
          if (!localBook?.isSaved) {
            promises.push(toggleSaveBook(bookId));
          }
          Promise.all(promises).catch(err => {
            console.error('[AuthorDetail] Optimistic update failed:', err);
          });
        }
      } catch (error) {
        console.error('[AuthorDetail] Failed to update book status:', error);
        Alert.alert('Erreur', 'Impossible de mettre à jour le statut du livre.');
      }
    };

    if (Platform.OS === 'ios') {
      const iosOptions = ['Annuler', ...options.map(o => o.label)];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: iosOptions,
          cancelButtonIndex: 0,
          title: 'Classer ce livre',
        },
        async (buttonIndex) => {
          if (buttonIndex > 0) {
            const selected = options[buttonIndex - 1];
            await changeStatus(selected.value);
          }
        }
      );
      return;
    }

    const androidButtons: any[] = [
      { text: 'Annuler', style: 'cancel' },
      ...STATUS_OPTIONS.map(o => ({
        text: o.label,
        onPress: () => changeStatus(o.value)
      }))
    ];

    Alert.alert('Classer ce livre', 'Choisissez une catégorie', androidButtons);
  };

  if (isLoadingAuthor) {
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
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="clip">
                {authorName}
              </Text>
              <View style={styles.fadeOverlayContainer} pointerEvents="none">
                <Svg width={32} height="100%">
                  <Defs>
                    <LinearGradient id="loadingAuthorTitleFade" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
                      <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
                    </LinearGradient>
                  </Defs>
                  <Rect width={32} height="100%" fill="url(#loadingAuthorTitleFade)" />
                </Svg>
              </View>
            </View>
            <View style={styles.headerActions} />
          </View>
          <AuthorSkeleton colors={colors} />
        </View>
      </SafeAreaView>
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
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="clip">
              {authorName}
            </Text>
            <View style={styles.fadeOverlayContainer} pointerEvents="none">
              <Svg width={32} height="100%">
                <Defs>
                  <LinearGradient id="authorTitleFade" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
                    <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
                  </LinearGradient>
                </Defs>
                <Rect width={32} height="100%" fill="url(#authorTitleFade)" />
              </Svg>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
              <ShareIcon size={22} color={colors.text} />
            </TouchableOpacity>
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
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.profileHeader}>
            <Image source={{ uri: authorImage }} style={styles.authorImage} />
            <Text style={styles.authorName}>{authorName}</Text>

            {resolvedAuthorInfo && resolvedAuthorInfo.id !== 0 && (
              <>
                <Text style={styles.followersText}>
                  {(() => {
                    const count = resolvedAuthorInfo.followersCount ?? 0;
                    if (count === 0) return "Aucun abonné";
                    return `Suivi par ${count} personne${count > 1 ? 's' : ''}`;
                  })()}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.followButton,
                    resolvedAuthorInfo.isSaved ? styles.followButtonActive : styles.followButtonInactive
                  ]}
                  onPress={handleToggleFollow}
                  activeOpacity={0.8}
                >
                  {resolvedAuthorInfo.isSaved ? (
                    <UserCheck size={16} color={colors.textSecondary} />
                  ) : (
                    <UserPlus size={16} color={colors.buttonText} />
                  )}
                  <Text
                    style={[
                      styles.followButtonText,
                      resolvedAuthorInfo.isSaved ? styles.followButtonTextActive : styles.followButtonTextInactive
                    ]}
                  >
                    {resolvedAuthorInfo.isSaved ? 'Suivi' : 'Suivre'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.wikipediaButton}
              onPress={handleOpenWikipedia}
              activeOpacity={0.7}
            >
              <View style={styles.wikipediaLogoContainer}>
                <Image
                  source={{ uri: 'https://www.wikipedia.org/portal/wikipedia.org/assets/img/Wikipedia-logo-v2.png' }}
                  style={styles.wikipediaLogo}
                />
              </View>
              <Text style={styles.wikipediaText}>Wikipédia</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.authorBlockWrapper}>
            <AuthorBlock author={resolvedAuthorInfo} hideName={true} />
          </View>

          <View style={styles.detailContainerSection}>
            <View style={styles.detailsContainer}>
              <View style={styles.detailItem}>
                <Calendar size={16} color={colors.textTertiary} />
                <Text style={styles.detailLabel}>Naissance</Text>
                <Text style={styles.detailValue}>{formatFlexibleDate(resolvedAuthorInfo?.birthDate)}</Text>
              </View>
              <View style={styles.detailItem}>
                <Globe size={16} color={colors.textTertiary} />
                <Text style={styles.detailLabel}>Nationalité</Text>
                <Text style={styles.detailValue}>{resolvedAuthorInfo?.nationality || 'Inconnue'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={fetchAllWorks}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{totalBooksCount}</Text>
              <Text style={styles.statLabel}>Œuvres</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => {
                if (totalQuotes > 0) {
                  setHasRenderedQuotesModal(true);
                  setShowAllQuotesModal(true);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{totalQuotes}</Text>
              <Text style={styles.statLabel}>Citations</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Œuvres Notables</Text>
            </View>

            {notableWorks.length === 0 && !isLoadingAuthor && !isLoadingAllWorks && (
              <Text style={styles.emptyText}>Aucune œuvre notable trouvée.</Text>
            )}

            {notableWorks.slice(0, 7).map((book, index) => {
              const localBook = allBooks.find(b => 
                (book.inventaireUri && b.inventaireUri === book.inventaireUri) || 
                b.title.toLowerCase() === book.title.toLowerCase()
              );
              
              const quoteCount = quotes.filter(q => {
                const qBookTitle = getBookTitle(q.book);
                return qBookTitle.toLowerCase() === book.title.toLowerCase();
              }).length;

              const bookAuthors: string[] = [];
              if (book.author) {
                if (typeof book.author === 'string') {
                  bookAuthors.push(book.author);
                } else if (book.author.name) {
                  bookAuthors.push(book.author.name);
                }
              }
              if (bookAuthors.length === 0) {
                bookAuthors.push(authorName);
              }

              const mappedBook = {
                title: book.title,
                id: localBook?.id ?? book.id,
                authors: bookAuthors,
                quoteCount: quoteCount,
                year: book.year,
                description: localBook?.description ?? book.description ?? '',
                cover: book.cover,
                readingStatus: localBook?.readingStatus ?? book.readingStatus,
                inventaireUri: book.inventaireUri,
                isSaved: localBook?.isSaved ?? false,
              };

              return (
                <BookCardItem
                  key={`${book.id || book.title}-${index}`}
                  book={mappedBook}
                  showDescription={false}
                  showAddButton={true}
                  onAddPress={() => handleAddBook(mappedBook)}
                  onAddLongPress={() => handleOpenBookStatusMenu(mappedBook)}
                />
              );
            })}

            {(allWorks.length > notableWorks.length || notableWorks.length > 7) && (
              <TouchableOpacity
                style={styles.showAllButton}
                onPress={fetchAllWorks}
              >
                <Text style={styles.showAllButtonText}>Afficher toutes les œuvres</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.blockWrapper}>
            {(() => {
              const userQuotes = quotes.filter(q => {
                return isUserQuote(q, currentUser?.id) && getAuthorName(q.author).toLowerCase() === authorName.toLowerCase();
              });

              return (
                <SavedQuotesBlock
                  quotes={userQuotes}
                  showBookTitle={true}
                  onQuotePress={(quote) => router.navigate({ pathname: '/quote-detail', params: { quote: JSON.stringify(quote) } })}
                  onAddQuote={openAddQuoteFlow}
                />
              );
            })()}
          </View>

          {resolvedAuthorInfo?.similarAuthors && resolvedAuthorInfo.similarAuthors.length > 0 && (
            <View style={styles.blockWrapper}>
              <SimilarBlock
                type="author"
                items={resolvedAuthorInfo.similarAuthors.map(simAuthor => ({
                  id: simAuthor.id,
                  title: simAuthor.name,
                  image: simAuthor.image,
                  inventaireUri: simAuthor.inventaireUri,
                }))}
                onPress={(idOrTitle, inventaireUri) => navigateToAuthor(idOrTitle, inventaireUri)}
              />
            </View>
          )}
        </ScrollView>



        {hasRenderedQuotesModal && (
          <Modal
            visible={showAllQuotesModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowAllQuotesModal(false)}
          >
            <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right']}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Citations de {authorName}</Text>
                <TouchableOpacity onPress={() => setShowAllQuotesModal(false)}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <FlashList
                data={authorQuotes}
                keyExtractor={(item) => String(item.id)}
                getItemType={() => 'quote'}
                removeClippedSubviews={true}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => {
                  const isMine = item.user?.id === currentUser?.id || !item.user;
                  return (
                    <TouchableOpacity
                      style={styles.quoteModalCard}
                      activeOpacity={0.8}
                      onPress={() => {
                        setShowAllQuotesModal(false);
                        router.navigate({
                          pathname: '/quote-detail',
                          params: { quote: JSON.stringify(item) }
                        });
                      }}
                    >
                      <Text style={styles.quoteModalText}>“ {item.text} ”</Text>
                      <View style={styles.quoteModalMeta}>
                        <Text style={styles.quoteModalBook}>{getBookTitle(item.book)}</Text>
                        <Text style={styles.quoteModalUser}>
                          Par {isMine ? 'Moi' : item.user?.name || `@${item.user?.username}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.centered}>
                    <Text style={styles.emptyText}>Aucune citation trouvée.</Text>
                  </View>
                }
              />
            </SafeAreaView>
          </Modal>
        )}

        {renderQuoteModals()}
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
    backgroundColor: colors.background,
    position: 'relative',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 80,
    right: 80,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '100%',
  },
  fadeOverlayContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerButton: { padding: 4 },
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
    marginBottom: 16,
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
    marginBottom: 8,
  },
  followersText: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 12,
    fontWeight: '500',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  followButtonInactive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  followButtonActive: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceHighlight,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  followButtonTextInactive: {
    color: colors.buttonText,
  },
  followButtonTextActive: {
    color: colors.textSecondary,
  },
  wikipediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  wikipediaLogoContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  wikipediaLogo: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  wikipediaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
    marginBottom: 16,
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
  authorBlockWrapper: {
    marginBottom: 6, // Compense le marginBottom de 10px du BlockWrapper pour atteindre 16px
  },
  blockWrapper: {
    marginBottom: 6, // Compense le marginBottom de 10px du BlockWrapper pour atteindre 16px
  },
  detailContainerSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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

  emptyText: {
    color: colors.textTertiary,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 10,
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
  modalSectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceHighlight,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  modalSectionHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quoteModalCard: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  quoteModalText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 12,
    fontFamily: 'serif',
  },
  quoteModalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  quoteModalBook: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  quoteModalUser: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  modalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.warningLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: 16,
    marginBottom: 8,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  modalErrorRetryButton: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalErrorRetryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});