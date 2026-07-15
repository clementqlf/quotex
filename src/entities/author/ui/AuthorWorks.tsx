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
  const authorName = params.authorName || 'Inconnu';
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
  const { data: allWorks = [], isLoading: isLoadingAllWorks } = useQuery({
    queryKey: ['author-all-works', resolvedAuthorId, authorName],
    queryFn: async () => {
      if (!resolvedAuthorId || !authorName) throw new Error('Author ID or name missing');
      return getBooksByAuthor(authorName, resolvedAuthorId);
    },
    enabled: !!resolvedAuthorId && !!authorName,
    staleTime: 30 * 1000
  });

  // Query for external books from Google Books
  const { data: externalBooks = [], isLoading: isLoadingExternalBooks, isError: isErrorExternalBooks, refetch: refetchExternalBooks } = useQuery({
    queryKey: ['author-external-books', resolvedAuthorId],
    queryFn: () => {
      if (!resolvedAuthorId) return Promise.resolve([]);
      return getExternalBooksByAuthor(resolvedAuthorId);
    },
    enabled: !!resolvedAuthorId,
    staleTime: 5 * 60 * 1000
  });

  const normalizeTitle = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  const openLibraryCover = (item: { cover?: string | null; isbn?: string | null; title: string }): string | undefined => {
    if (item.cover) return item.cover;
    if (item.isbn) {
      return `https://covers.openlibrary.org/b/isbn/${item.isbn}-M.jpg`;
    }
    const encoded = encodeURIComponent(item.title);
    return `https://covers.openlibrary.org/b/title/${encoded}-M.jpg`;
  };

  const filteredExternalBooks = useMemo(() => {
    const localTitles = new Set(allWorks.map(b => normalizeTitle(b.title)));
    const uniqueExternal = new Map<string, any>();
    for (const b of externalBooks) {
      const normalized = normalizeTitle(b.title);
      if (localTitles.has(normalized)) continue;
      
      const existing = uniqueExternal.get(normalized);
      if (!existing || (!existing.cover && b.cover)) {
        uniqueExternal.set(normalized, b);
      }
    }
    return Array.from(uniqueExternal.values());
  }, [externalBooks, allWorks]);

  const combinedWorks = useMemo(() => {
    const externalByTitle = new Map<string, any>();
    for (const b of externalBooks) {
      const key = normalizeTitle(b.title);
      const existing = externalByTitle.get(key);
      if (!existing) {
        externalByTitle.set(key, b);
      } else {
        const existingScore = (existing.cover ? 2 : 0) + (existing.description ? 1 : 0);
        const newScore = (b.cover ? 2 : 0) + (b.description ? 1 : 0);
        if (newScore > existingScore) {
          externalByTitle.set(key, b);
        }
      }
    }

    const list: any[] = allWorks.map(b => {
      const external = externalByTitle.get(normalizeTitle(b.title));
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
      list.push({ type: 'header', title: 'Disponibles sur Google Books' });
      list.push(...filteredExternalBooks.map(b => ({ ...b, isExternal: true })));
    }
    return list;
  }, [allWorks, filteredExternalBooks, isLoadingExternalBooks, isErrorExternalBooks, externalBooks]);

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
