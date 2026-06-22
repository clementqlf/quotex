import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { authService } from '@/src/entities/user/api/AuthService';
import { Author, Book, ReadingStatus } from '@/src/shared/api/types';
import BookCardItem from '@/src/entities/book/ui/BookCardItem';
import { API_BASE_URL } from '@/src/shared/config/api';
import { getAuthorName, getBookTitle, isUserQuote, STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { logFetchError } from '@/src/shared/lib/offline/networkUtils';
import { ThemeColors } from '@/src/shared/theme';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Bookmark, BookOpen, Calendar, ChevronLeft, Globe, Share as ShareIcon, UserCheck, UserPlus, X } from 'lucide-react-native';
import React, { useMemo, useState, useCallback } from 'react';
import { AuthorBlock } from '@/src/shared/ui/blocks/AuthorBlock';
import { SavedQuotesBlock } from '@/src/shared/ui/blocks/SavedQuotesBlock';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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

// Fetch author details from Inventaire API (client-side version)
async function fetchExternalAuthorDetails(inventaireUri: string) {
  try {
    const url = `https://inventaire.io/api/entities/by-uris?uris=${encodeURIComponent(inventaireUri)}&lang=fr&props=labels|descriptions|claims|image`;
    const res = await fetch(url, { headers: { 'User-Agent': 'QuotexApp/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data.entities?.[inventaireUri];
    if (!entity) return null;

    const labels = entity.labels || {};
    const descriptions = entity.descriptions || {};
    const claims = entity.claims || {};
    const name = labels['fr'] || labels['en'] || null;
    const description = descriptions['fr'] || descriptions['en'] || null;
    const image = entity.image?.url || entity.image?.file
      ? `https://inventaire.io${entity.image?.url || entity.image?.file}`
      : null;
    const birthDateRaw = claims['wdt:P569']?.[0];
    let birthDate = null;
    if (birthDateRaw) {
      const cleanDate = birthDateRaw.startsWith('+') ? birthDateRaw.substring(1) : birthDateRaw;
      birthDate = cleanDate.split('T')[0];
    }

    return { name, description, image, birthDate, nationality: null };
  } catch (e) {
    logFetchError('[AuthorDetail] Failed to fetch external author details', e);
    return null;
  }
}

const formatDisplayDate = (dateStr?: string | null): string => {
  if (!dateStr) return 'Inconnu';
  if (/^\d{4}$/.test(dateStr)) return dateStr;
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime()) && (dateStr.includes('-') || dateStr.includes('/'))) {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return dateStr;
};

export default function AuthorDetailScreen() {
  const { user: currentUser } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { navigateToBook } = useSmartNavigation();
  const params = useLocalSearchParams<{ author?: string; authorName?: string; inventaireUri?: string }>();
  const paramInventaireUri = params.inventaireUri;
  const author: Author | undefined = params.author ? JSON.parse(params.author as string) : undefined;
  const paramAuthorName = params.authorName;
  const nameToUse = author?.name || paramAuthorName;

  // Remplacement de useData() par les hooks spécifiques
  const { quotes } = useQuote();
  const { authors: allAuthors, books: allBooks, getBooksByAuthor, getAuthorByName, toggleSaveAuthor, getNotableWorks, importBook, toggleSaveBook, updateBookStatus } = useAuthor();
  
  // Wrapper pour toggleLikeQuote depuis useQuote
  const { toggleLikeQuote } = useQuote();
  const [authorInfo, setAuthorInfo] = React.useState<Author | null>(author || null);
  const [authorBooks, setAuthorBooks] = React.useState<Book[]>([]);
  const [isLoadingAuthor, setIsLoadingAuthor] = React.useState(true);




  // New state for All Works Modal
  const [showAllWorksModal, setShowAllWorksModal] = React.useState(false);
  const [hasRenderedModal, setHasRenderedModal] = React.useState(false);
  const [allWorks, setAllWorks] = React.useState<Book[]>([]);
  const [isLoadingAllWorks, setIsLoadingAllWorks] = React.useState(false);

  const loadAuthorData = React.useCallback(async (signal?: AbortSignal) => {
    if (!nameToUse) return;

    // 1. Try to find the author in our local cache first!
    let localAuthor = author || allAuthors.find(a => a.name.toLowerCase() === nameToUse.toLowerCase());

    // 2. If we have the author locally, set it and disable full-screen loading immediately!
    if (localAuthor) {
      console.log('[AuthorDetail] Found author in local cache, loading instantly');
      setAuthorInfo(localAuthor);
      setIsLoadingAuthor(false);
    } else {
      setIsLoadingAuthor(true);
    }

    try {
      const initialAuthorId = localAuthor?.id || author?.id;
      const needsFetch = !initialAuthorId;

      console.log(`[AuthorDetail] Loading data for: ${nameToUse} (uri: ${paramInventaireUri})`);

      const [internalBooks, fetchedAuthor, wikiBooks] = await Promise.all([
        getBooksByAuthor(nameToUse, initialAuthorId),
        needsFetch ? getAuthorByName(nameToUse) : Promise.resolve(null),
        initialAuthorId ? getNotableWorks(initialAuthorId) : Promise.resolve([])
      ]);

      let booksToDisplay = wikiBooks.length > 0 ? wikiBooks : internalBooks;
      let activeAuthor = localAuthor || author || fetchedAuthor;

      if (fetchedAuthor) {
        setAuthorInfo(fetchedAuthor);
        activeAuthor = fetchedAuthor;

        // If we didn't have an ID initially, we couldn't fetch notable works. Fetch them now!
        if (!initialAuthorId && fetchedAuthor.id) {
          console.log(`[AuthorDetail] Author fetched with ID ${fetchedAuthor.id}, now fetching notable works...`);
          try {
            const fetchedWikiBooks = await getNotableWorks(fetchedAuthor.id);
            if (fetchedWikiBooks && fetchedWikiBooks.length > 0) {
              booksToDisplay = fetchedWikiBooks;
            }
          } catch (e) {
            logFetchError('[AuthorDetail] Failed to fetch notable works after author retrieval', e);
          }
        }

        // Force enrichment if description is missing
        if (fetchedAuthor.inventaireUri && (!fetchedAuthor.description || fetchedAuthor.description.length < 50)) {
          console.log('[AuthorDetail] Author sparse, forcing synchronous enrichment...');
          try {
            const BASE_URL = API_BASE_URL;
            const token = await authService.getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const enrichRes = await fetch(`${BASE_URL}/authors/${fetchedAuthor.id}/enrich`, { method: 'POST', headers, signal });
            if (enrichRes.ok) {
              const data = await enrichRes.json();
              if (data.author) {
                setAuthorInfo(data.author);
                activeAuthor = data.author;
              }
              if (data.books) setAuthorBooks(data.books);
            }
          } catch (e) {
            logFetchError('[AuthorDetail] Synch enrichment failed', e);
          }
        }
      } else if (!activeAuthor && paramInventaireUri) {
        // Author not in local DB — enrich from Inventaire using the URI from params
        console.log(`[AuthorDetail] Author not local, fetching from Inventaire: ${paramInventaireUri}`);
        const externalDetails = await fetchExternalAuthorDetails(paramInventaireUri);
        if (externalDetails) {
          const newAuthorObj = {
            id: 0,
            name: externalDetails.name || nameToUse || '',
            description: externalDetails.description || undefined,
            image: externalDetails.image || undefined,
            birthDate: externalDetails.birthDate || undefined,
            nationality: externalDetails.nationality || undefined,
            inventaireUri: paramInventaireUri,
            isSaved: false,
          } as any;
          setAuthorInfo(newAuthorObj);
          activeAuthor = newAuthorObj;
        }
      }

      setAuthorBooks(booksToDisplay);

    } catch (error) {
      logFetchError("Error loading author data", error);
    } finally {
      setIsLoadingAuthor(false);
    }
  }, [nameToUse, paramInventaireUri, allAuthors, getBooksByAuthor, getAuthorByName, getNotableWorks, author]);

  React.useEffect(() => {
    const controller = new AbortController();
    
    // Defer the call using a microtask to avoid synchronous setState inside the effect body
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        loadAuthorData(controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [loadAuthorData]);

  const fetchAllWorks = async () => {
    if (!nameToUse) return;
    setHasRenderedModal(true);
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
      logFetchError("Error fetching all works", error);
    } finally {
      setIsLoadingAllWorks(false);
    }
  };

  const authorName = authorInfo?.name || nameToUse || 'Inconnu';
  const authorDesc = authorInfo?.description || `${authorName} est un auteur reconnu.`;
  const authorImage = authorInfo?.image || 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=400&h=400&fit=crop';



  const totalQuotes = useMemo(() => quotes.filter(q =>
    getAuthorName(q.author).toLowerCase() === authorName.toLowerCase()
  ).length, [quotes, authorName]);

  const userQuotesCount = useMemo(() => quotes.filter(q => {
    return isUserQuote(q, currentUser?.id) && getAuthorName(q.author).toLowerCase() === authorName.toLowerCase();
  }).length, [quotes, authorName, currentUser]);

  const isSaved = authorInfo?.isSaved || userQuotesCount > 0;
  const canToggleSave = userQuotesCount === 0;

  const handleToggleSave = async () => {
    if (!canToggleSave || !authorInfo?.id) return;
    const res = await toggleSaveAuthor(authorInfo.id);
    if (res) {
      setAuthorInfo(prev => prev ? { ...prev, isSaved: res.isSaved, followersCount: res.followersCount } : null);
    }
  };

  const handleToggleFollow = async () => {
    if (!authorInfo?.id) return;
    const res = await toggleSaveAuthor(authorInfo.id);
    if (res) {
      setAuthorInfo(prev => prev ? { ...prev, isSaved: res.isSaved, followersCount: res.followersCount } : null);
    }
  };

  const handleShare = async () => {
    if (!authorInfo) return;
    try {
      await Share.share({
        message: `Découvrez l'auteur "${authorName}" sur Quotex !`,
      });
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleOpenWikipedia = async () => {
    if (!authorInfo?.inventaireUri || !authorInfo.inventaireUri.startsWith('wd:')) {
      // Fallback: search by name if no URI
      const searchUrl = `https://fr.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(authorName)}`;
      await WebBrowser.openBrowserAsync(searchUrl);
      return;
    }

    const qid = authorInfo.inventaireUri.replace('wd:', '');
    const wikiUrl = `https://www.wikidata.org/wiki/Special:GoToLinkedPage/frwiki/${qid}`;
    await WebBrowser.openBrowserAsync(wikiUrl);
  };

  const handleAddBook = async (book: any) => {
    try {
      const localBook = allBooks.find(b => 
        (book.inventaireUri && b.inventaireUri === book.inventaireUri) || 
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
            Promise.all([
              toggleSaveBook(idToUnsave),
              updateBookStatus(idToUnsave, null as any)
            ]).catch(err => {
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
        const importPayload = {
          title: book.title,
          cover: book.cover,
          description: book.description || '',
          year: book.year || 0,
          pages: book.pages || 0,
          genre: book.genre || 'Unknown',
          authors: book.authors || [authorName],
          inventaireUri: book.inventaireUri,
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
      b.title.toLowerCase() === book.title.toLowerCase()
    );

    if (localBook) {
      bookId = localBook.id;
    }

    const options = [...STATUS_OPTIONS];

    const changeStatus = async (status: string) => {
      try {
        if (!bookId) {
          const importPayload = {
            title: book.title,
            cover: book.cover,
            description: book.description || '',
            year: book.year || 0,
            pages: book.pages || 0,
            genre: book.genre || 'Unknown',
            authors: book.authors || [authorName],
            inventaireUri: book.inventaireUri,
            readingStatus: status,
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
            <Text style={styles.headerTitle} numberOfLines={1}>{authorName}</Text>
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
          <Text style={styles.headerTitle} numberOfLines={1}>{authorName}</Text>
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
        >
          <View style={styles.profileHeader}>
            <Image source={{ uri: authorImage }} style={styles.authorImage} />
            <Text style={styles.authorName}>{authorName}</Text>

            {authorInfo && authorInfo.id !== 0 && (
              <>
                <Text style={styles.followersText}>
                  {(() => {
                    const count = authorInfo.followersCount ?? 0;
                    if (count === 0) return "Aucun abonné";
                    return `Suivi par ${count} personne${count > 1 ? 's' : ''}`;
                  })()}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.followButton,
                    authorInfo.isSaved ? styles.followButtonActive : styles.followButtonInactive
                  ]}
                  onPress={handleToggleFollow}
                  activeOpacity={0.8}
                >
                  {authorInfo.isSaved ? (
                    <UserCheck size={16} color={colors.textSecondary} />
                  ) : (
                    <UserPlus size={16} color={colors.buttonText} />
                  )}
                  <Text
                    style={[
                      styles.followButtonText,
                      authorInfo.isSaved ? styles.followButtonTextActive : styles.followButtonTextInactive
                    ]}
                  >
                    {authorInfo.isSaved ? 'Suivi' : 'Suivre'}
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

          <AuthorBlock author={authorInfo} hideName={true} />

          <View style={styles.detailContainerSection}>
            <View style={styles.detailsContainer}>
              <View style={styles.detailItem}>
                <Calendar size={16} color={colors.textTertiary} />
                <Text style={styles.detailLabel}>Naissance</Text>
                <Text style={styles.detailValue}>{formatDisplayDate(authorInfo?.birthDate)}</Text>
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

            {authorBooks.map((book, index) => {
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

            <TouchableOpacity
              style={styles.showAllButton}
              onPress={fetchAllWorks}
            >
              <Text style={styles.showAllButtonText}>Afficher toutes les œuvres</Text>
            </TouchableOpacity>
          </View>

          {(() => {
            const userQuotes = quotes.filter(q => {
              return isUserQuote(q, currentUser?.id) && getAuthorName(q.author).toLowerCase() === authorName.toLowerCase();
            });

            if (userQuotes.length === 0) return null;

            return (
              <SavedQuotesBlock
                quotes={userQuotes}
                showBookTitle={true}
                onQuotePress={(quote) => router.navigate({ pathname: '/quote-detail', params: { quote: JSON.stringify(quote) } })}
              />
            );
          })()}
        </ScrollView>

        {hasRenderedModal && (
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
                <FlashList
                  data={allWorks}
                  keyExtractor={(item, index) => `${item.id || item.title}-${index}`}
                  getItemType={() => 'work'}
                  contentContainerStyle={{ padding: 16 }}
                  renderItem={({ item }) => {
                    const localBook = allBooks.find(b => 
                      (item.inventaireUri && b.inventaireUri === item.inventaireUri) || 
                      b.title.toLowerCase() === item.title.toLowerCase()
                    );
                    
                    const quoteCount = quotes.filter(q => {
                      const qBookTitle = getBookTitle(q.book);
                      return qBookTitle.toLowerCase() === item.title.toLowerCase();
                    }).length;

                    const bookAuthors: string[] = [];
                    if (item.author) {
                      if (typeof item.author === 'string') {
                        bookAuthors.push(item.author);
                      } else if (item.author.name) {
                        bookAuthors.push(item.author.name);
                      }
                    }
                    if (bookAuthors.length === 0) {
                      bookAuthors.push(authorName);
                    }

                    const mappedBook = {
                      title: item.title,
                      id: localBook?.id ?? item.id,
                      authors: bookAuthors,
                      quoteCount: quoteCount,
                      year: item.year,
                      description: localBook?.description ?? item.description ?? '',
                      cover: item.cover,
                      readingStatus: localBook?.readingStatus ?? item.readingStatus,
                      inventaireUri: item.inventaireUri,
                      isSaved: localBook?.isSaved ?? false,
                    };

                    return (
                      <BookCardItem
                        book={mappedBook}
                        showDescription={false}
                        showAddButton={true}
                        onAddPress={() => handleAddBook(mappedBook)}
                        onAddLongPress={() => handleOpenBookStatusMenu(mappedBook)}
                        onPress={() => {
                          setShowAllWorksModal(false);
                          navigateToBook(item.id ?? item.title, item.inventaireUri);
                        }}
                      />
                    );
                  }}
                />
              )}
            </View>
          </Modal>
        )}
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
    flex: 1,
    textAlign: 'center',
    marginLeft: 8
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