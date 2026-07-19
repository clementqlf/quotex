import React, { useMemo, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActionSheetIOS,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { AlertTriangle, ChevronLeft } from 'lucide-react-native';

import { useTheme } from '@/src/app/providers/ThemeContext';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import BookCardItem from '@/src/entities/book/ui/BookCardItem';
import { getBookTitle, STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors } from '@/src/shared/theme';
import { ReadingStatus } from '@/src/shared/api/types';

export default function AuthorWorksScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { navigateToBook, goBack } = useSmartNavigation();
  
  const isNavigatingRef = useRef(false);

  // Reset navigation lock when screen is focused
  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
    }, [])
  );
  
  const params = useLocalSearchParams<{ authorId?: string; authorName?: string; inventaireUri?: string }>();
  const authorName = params.authorName || 'Auteur inconnu';
  const authorIdParam = params.authorId ? parseInt(params.authorId, 10) : undefined;
  const resolvedAuthorId = authorIdParam && !isNaN(authorIdParam) ? authorIdParam : undefined;

  const { quotes } = useQuote();
  const { 
    books: allBooks, 
    getBooksByAuthor, 
    getExternalBooksByAuthor, 
    resolveGoogleBook, 
    importBook, 
    toggleSaveBook, 
    updateBookStatus 
  } = useAuthor();

  // Use TanStack Query for all works (all books in DB for this author)
  const { 
    data: allWorks = [], 
    isLoading: isLoadingAllWorks,
    isFetching: isFetchingAllWorks,
    refetch: refetchAllWorks
  } = useQuery({
    queryKey: ['author-all-works', resolvedAuthorId, authorName],
    queryFn: async () => {
      if (!resolvedAuthorId || !authorName) throw new Error('Author ID or name missing');
      return getBooksByAuthor(authorName, resolvedAuthorId);
    },
    enabled: !!resolvedAuthorId && !!authorName,
    staleTime: 30 * 1000
  });

  // Query for external books from Google Books
  const { 
    data: externalBooks = [], 
    isLoading: isLoadingExternalBooks, 
    isFetching: isFetchingExternalBooks,
    isError: isErrorExternalBooks, 
    refetch: refetchExternalBooks 
  } = useQuery({
    queryKey: ['author-external-books', resolvedAuthorId],
    queryFn: () => {
      if (!resolvedAuthorId) return Promise.resolve([]);
      return getExternalBooksByAuthor(resolvedAuthorId);
    },
    enabled: !!resolvedAuthorId,
    staleTime: 5 * 60 * 1000
  });

  const isRefreshing = isFetchingAllWorks || isFetchingExternalBooks;

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetchAllWorks().catch(() => {}),
      refetchExternalBooks().catch(() => {})
    ]);
  }, [refetchAllWorks, refetchExternalBooks]);

  const normalizeTitle = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  const getBaseTitle = (title: string) => {
    // Sépare le titre du sous-titre sur les délimiteurs courants
    const parts = title.split(/[:\-\/(\[—]/);
    return parts[0].trim();
  };

  const stripVolumeInfo = (title: string) => {
    let base = getBaseTitle(title);
    
    // 1. Chercher un indicateur de volume explicite (ex: "tome i", "vol. 2")
    // Si trouvé, on coupe le titre et on ne garde que ce qui est avant l'indicateur
    const matchVolume = base.match(/\b(tome|volume|vol|partie|part|book|livre|t)\s*([0-9ivxldm]+)\b/i);
    if (matchVolume) {
      const index = base.indexOf(matchVolume[0]);
      base = base.substring(0, index).trim();
    }
    
    // 2. Chercher un numéro de volume orphelin à la fin (ex: "Les Miserables I" ou "Dune 2")
    // On ne coupe que si le préfixe restant fait au moins 4 caractères
    const trimmed = base.trim();
    const matchOrphan = trimmed.match(/\s+([0-9ivxldm]+)$/i);
    if (matchOrphan) {
      const number = matchOrphan[1];
      const prefix = trimmed.substring(0, trimmed.length - number.length).trim();
      const cleanPrefix = prefix.replace(/[:\-\/;,\s\/]+$/, '');
      if (cleanPrefix.length >= 4) {
        base = cleanPrefix;
      }
    }
    
    return base.replace(/[:\-\/;,\s\/]+$/, '').trim();
  };

  const cleanTitleFromAuthor = useCallback((title: string, author: string) => {
    if (!title || !author || author === 'Inconnu' || author === 'Auteur inconnu') return title;
    
    const normTitle = normalizeTitle(title);
    const normAuthor = normalizeTitle(author);
    const lowerTitle = title.toLowerCase().trim();
    const lowerAuthor = author.toLowerCase().trim();
    
    // 1. Si le titre commence par l'auteur (avec ou sans préposition devant)
    const prepositions = ['par', 'de', 'by', 'of'];
    let matchedPrefix = '';
    
    if (normTitle.startsWith(normAuthor)) {
      matchedPrefix = author;
    } else {
      for (const prep of prepositions) {
        if (normTitle.startsWith(prep + normAuthor)) {
          const idx = lowerTitle.indexOf(lowerAuthor);
          if (idx !== -1) {
            matchedPrefix = title.substring(0, idx + author.length);
          }
          break;
        }
      }
    }
    
    if (matchedPrefix) {
      let cleaned = title.substring(matchedPrefix.length).trim();
      cleaned = cleaned.replace(/^[:\-\/;,\s\/]+/, '');
      if (cleaned.length > 0) return cleaned;
    }
    
    // 2. Si le titre se termine par l'auteur
    if (normTitle.endsWith(normAuthor)) {
      let cleaned = title.substring(0, title.length - author.length).trim();
      cleaned = cleaned.replace(/[:\-\/;,\s\/]+$/, '');
      // Enlever aussi les prépositions courantes comme "par", "by", "de", "of" à la fin
      cleaned = cleaned.replace(/\s+(par|by|de|of)$/i, '');
      cleaned = cleaned.replace(/[:\-\/;,\s\/]+$/, ''); // Nettoyer à nouveau après retrait
      if (cleaned.length > 0) return cleaned;
    }
    
    return title;
  }, []);

  const isDuplicateTitle = useCallback((titleA: string, titleB: string) => {
    const normA = normalizeTitle(titleA);
    const normB = normalizeTitle(titleB);
    
    if (normA === normB) return true;

    // 1. Comparaison après suppression des informations de volume (Option B)
    const cleanA = normalizeTitle(stripVolumeInfo(titleA));
    const cleanB = normalizeTitle(stripVolumeInfo(titleB));
    
    if (cleanA === cleanB && cleanA.length >= 4) {
      return true;
    }
    
    // 2. Fallback préfixe uniquement pour les titres longs
    // pour éviter de fusionner des tomes courts (ex: "Dune" et "Dune le messie")
    if (normA.length >= 15 && normB.length >= 15) {
      if (normA.startsWith(normB) || normB.startsWith(normA)) {
        return true;
      }
    }
    
    return false;
  }, []);

  const openLibraryCover = (item: { cover?: string | null; isbn?: string | null; title: string }): string | undefined => {
    if (item.cover) return item.cover;
    if (item.isbn) {
      return `https://covers.openlibrary.org/b/isbn/${item.isbn}-M.jpg`;
    }
    const encoded = encodeURIComponent(item.title);
    return `https://covers.openlibrary.org/b/title/${encoded}-M.jpg`;
  };

  const filteredExternalBooks = useMemo(() => {
    const uniqueExternal: any[] = [];
    
    for (const rawB of externalBooks) {
      const b = {
        ...rawB,
        title: cleanTitleFromAuthor(rawB.title, authorName),
        label: cleanTitleFromAuthor(rawB.label || rawB.title, authorName),
      };

      // Vérifier si le livre est déjà présent localement
      const isLocal = allWorks.some(lw => isDuplicateTitle(lw.title, b.title));
      if (isLocal) continue;
      
      const existingIndex = uniqueExternal.findIndex(item => isDuplicateTitle(item.title, b.title));
      if (existingIndex === -1) {
        uniqueExternal.push({ ...b });
      } else {
        const existing = uniqueExternal[existingIndex];
        const merged = { ...existing };
        if (!existing.cover && b.cover) merged.cover = b.cover;
        if (!existing.description && b.description) merged.description = b.description;
        if ((!existing.pages || existing.pages === 0) && b.pages) merged.pages = b.pages;
        if ((!existing.year || existing.year === 0) && b.year) merged.year = b.year;
        // On garde le titre le plus court (qui évite les répétitions de sous-titres)
        if (b.title.length < existing.title.length) {
          merged.title = b.title;
          merged.label = b.label || b.title;
        }
        uniqueExternal[existingIndex] = merged;
      }
    }
    return uniqueExternal;
  }, [externalBooks, allWorks, isDuplicateTitle, cleanTitleFromAuthor]);

  const combinedWorks = useMemo(() => {
    const externalList: any[] = [];
    
    for (const rawB of externalBooks) {
      const b = {
        ...rawB,
        title: cleanTitleFromAuthor(rawB.title, authorName),
        label: cleanTitleFromAuthor(rawB.label || rawB.title, authorName),
      };

      const existingIndex = externalList.findIndex(item => isDuplicateTitle(item.title, b.title));
      if (existingIndex === -1) {
        externalList.push({ ...b });
      } else {
        const existing = externalList[existingIndex];
        const merged = { ...existing };
        if (!existing.cover && b.cover) merged.cover = b.cover;
        if (!existing.description && b.description) merged.description = b.description;
        if ((!existing.pages || existing.pages === 0) && b.pages) merged.pages = b.pages;
        if ((!existing.year || existing.year === 0) && b.year) merged.year = b.year;
        if (b.title.length < existing.title.length) {
          merged.title = b.title;
          merged.label = b.label || b.title;
        }
        externalList[existingIndex] = merged;
      }
    }

    const list: any[] = allWorks.map(b => {
      const external = externalList.find(eb => isDuplicateTitle(b.title, eb.title));
      if (!external) return b;

      const merged: any = { ...b };
      if (!b.cover && external.cover) merged.cover = external.cover;
      if (!b.description && external.description) merged.description = external.description;
      if ((!b.pages || b.pages === 0) && external.pages) merged.pages = external.pages;
      if ((!b.year || b.year === 0) && external.year) merged.year = external.year;
      return merged;
    });

    if (isLoadingExternalBooks) {
      list.push({ type: 'loading', id: 'loading-external' });
    } else if (isErrorExternalBooks) {
      list.push({ type: 'error', id: 'error-external' });
    } else if (filteredExternalBooks.length > 0) {
      list.push({ type: 'header', title: 'Depuis Google Books' });
      list.push(...filteredExternalBooks.map(b => ({ ...b, isExternal: true })));
    }
    return list;
  }, [allWorks, filteredExternalBooks, isLoadingExternalBooks, isErrorExternalBooks, externalBooks, isDuplicateTitle, cleanTitleFromAuthor]);

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
              console.error('[AuthorWorks] Optimistic unsave failed:', err);
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
            console.warn('[AuthorWorks] Failed to resolve external book:', e);
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
          console.error('[AuthorWorks] Optimistic update failed:', err);
        });
        Alert.alert('Succès', `Le livre "${book.title}" a été ajouté à votre bibliothèque.`);
      }
    } catch (error) {
      console.error('[AuthorWorks] Failed to toggle book in library:', error);
      Alert.alert('Erreur', "Une erreur est survenue lors de la modification de la bibliothèque.");
    }
  };

  const handleImportExternalBook = useCallback(async (item: any) => {
    let resolved: any = null;
    try {
      resolved = await resolveGoogleBook(item.title, authorName);
    } catch { /* ignore, use original item */ }

    const mergedItem = {
      ...item,
      cover: resolved?.cover || item.cover || null,
      description: resolved?.description || item.description || '',
      pages: resolved?.pages || item.pages || 0,
      year: resolved?.year || item.year || 0,
      googleId: resolved?.googleId || item.googleId,
      isbn: resolved?.isbn || item.isbn || null,
    };

    router.push({
      pathname: '/book-detail',
      params: {
        bookTitle: mergedItem.title,
        inventaireUri: mergedItem.uri || `googlebooks:${mergedItem.googleId}`,
        bookData: JSON.stringify({
          label: mergedItem.title,
          title: mergedItem.title,
          cover: mergedItem.cover,
          description: mergedItem.description || '',
          year: mergedItem.year || 0,
          pages: mergedItem.pages || 0,
          genre: mergedItem.genre || 'Unknown',
          authors: mergedItem.authors || [authorName],
          googleId: mergedItem.googleId,
          isbn: mergedItem.isbn,
          uri: mergedItem.uri || `googlebooks:${mergedItem.googleId}`,
        }),
        skipCache: 'true'
      }
    });
  }, [resolveGoogleBook, authorName, router]);

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
              console.warn('[AuthorWorks] Failed to resolve external book:', e);
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
              console.error('[AuthorWorks] Optimistic update failed:', err);
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
            console.error('[AuthorWorks] Optimistic update failed:', err);
          });
        }
      } catch (error) {
        console.error('[AuthorWorks] Failed to update book status:', error);
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

  const handleBookPress = useCallback((mappedBook: any, item: any) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    // Safety timeout to reset navigation lock if something fails or is aborted
    const timer = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 4000);

    const cleanup = () => clearTimeout(timer);

    if (mappedBook.isExternal) {
      handleImportExternalBook(item)
        .catch(() => {
          isNavigatingRef.current = false;
        })
        .finally(cleanup);
    } else {
      try {
        navigateToBook(mappedBook.id ?? item.title, mappedBook.inventaireUri, item.title);
      } catch (err) {
        isNavigatingRef.current = false;
      } finally {
        cleanup();
      }
    }
  }, [navigateToBook, handleImportExternalBook]);

  return (
    <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right']}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Toutes les œuvres</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoadingAllWorks ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlashList
          data={combinedWorks}
          keyExtractor={(item, index) => `${item.id || item.title || item.type || index}-${index}`}
          getItemType={(item) => item.type || 'work'}
          removeClippedSubviews={true}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.modalSectionHeader}>
                  <Text style={styles.modalSectionHeaderTitle}>{item.title}</Text>
                </View>
              );
            }

            if (item.type === 'loading') {
              return (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              );
            }

            if (item.type === 'error') {
              return (
                <View style={styles.modalErrorContainer}>
                  <AlertTriangle size={20} color={colors.warning} style={{ marginRight: 8 }} />
                  <Text style={[styles.modalErrorText, { color: colors.textSecondary }]}>
                    Impossible de charger les œuvres de Google Books
                  </Text>
                  <TouchableOpacity onPress={() => refetchExternalBooks()} style={styles.modalErrorRetryButton}>
                    <Text style={styles.modalErrorRetryText}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            const localBook = allBooks.find(b => 
              (item.inventaireUri && b.inventaireUri === item.inventaireUri) || 
              (item.uri && b.inventaireUri === item.uri) ||
              (item.googleId && b.googleId === item.googleId) ||
              b.title.toLowerCase() === item.title.toLowerCase()
            );
            
            const quoteCount = quotes.filter(q => {
              const qBookTitle = getBookTitle(q.book);
              return qBookTitle.toLowerCase() === item.title.toLowerCase();
            }).length;

            const bookAuthors: string[] = [];
            if (item.authors && Array.isArray(item.authors) && item.authors.length > 0) {
              bookAuthors.push(...item.authors);
            } else if (item.author) {
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
              cover: openLibraryCover({ cover: item.cover, isbn: item.isbn, title: item.title }),
              readingStatus: localBook?.readingStatus ?? item.readingStatus,
              inventaireUri: localBook?.inventaireUri ?? item.inventaireUri ?? item.uri ?? (item.googleId ? `googlebooks:${item.googleId}` : undefined),
              isSaved: localBook?.isSaved ?? false,
              isExternal: !localBook && item.isExternal,
              googleId: localBook?.googleId ?? item.googleId,
              isbn: item.isbn,
              pages: item.pages,
            };

            return (
              <BookCardItem
                book={mappedBook}
                showDescription={false}
                showAddButton={true}
                onAddPress={() => handleAddBook(mappedBook)}
                onAddLongPress={() => handleOpenBookStatusMenu(mappedBook)}
                onPress={() => handleBookPress(mappedBook, item)}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    backButton: {
      padding: 4,
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
      paddingHorizontal: 0,
      marginTop: 0,
      marginBottom: 12,
    },
    modalSectionHeaderTitle: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
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
