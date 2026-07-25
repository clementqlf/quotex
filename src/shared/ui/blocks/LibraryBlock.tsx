import { useTheme } from '@/src/app/providers/ThemeContext';
import { Book } from '@/src/shared/api/types';
import { ReadingStatus } from '@/src/entities/author/model/Author';
import { AppText, BookCover } from '@/src/shared/ui';
import { preventDoublePress } from '@/src/shared/lib/pressUtils';
import { BlockWrapper } from './BlockWrapper';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useRouter } from '@/src/shared/navigation/useRouter';

interface LibraryBookItem {
  book: Book;
  status?: ReadingStatus | string;
}

interface LibraryBlockProps {
  books: Book[] | LibraryBookItem[];
  onRemove?: () => void;
  showStatus?: boolean;
  maxBooksPerStatus?: number;
  isLoading?: boolean;
}

// Statuts de lecture possibles - aligné avec le type ReadingStatus du domaine

const READING_STATUSES: ReadingStatus[] = ['READ', 'READING', 'TO_READ', 'DROPPED'];

const STATUS_LABELS: Record<ReadingStatus, string> = {
  READ: 'Terminé',
  READING: 'En cours',
  TO_READ: 'À lire',
  DROPPED: 'Abandonné',
};

export const LibraryBlock: React.FC<LibraryBlockProps> = ({
  books,
  onRemove,
  showStatus = true,
  maxBooksPerStatus = 10,
  isLoading = false,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  // Normaliser les livres : extraire le statut depuis book.readingStatus ou depuis l'objet parent
  const normalizedBooks: Book[] = useMemo(() => {
    return books.map((item) => {
      if ('book' in item) {
        // Format LibraryBookItem - fusionner les propriétés
        const libraryItem = item as LibraryBookItem;
        return { 
          ...libraryItem.book, 
          readingStatus: libraryItem.status as ReadingStatus || 'TO_READ' 
        };
      }
      // Format Book - retourner tel quel
      return item as Book;
    });
  }, [books]);

  // Grouper les livres par statut
  const groupedBooks = useMemo(() => {
    const groups: Record<string, Book[]> = {};
    READING_STATUSES.forEach((status) => {
      groups[status] = [];
    });

    normalizedBooks.forEach((book: Book) => {
      const status = (book.readingStatus as ReadingStatus) || 'TO_READ';
      if (READING_STATUSES.includes(status)) {
        if (!groups[status]) {
          groups[status] = [];
        }
        groups[status].push(book);
      } else {
        // Si le statut n'est pas reconnu, le mettre dans TO_READ
        if (!groups['TO_READ']) {
          groups['TO_READ'] = [];
        }
        groups['TO_READ'].push(book);
      }
    });

    return groups;
  }, [normalizedBooks]);

  // Filtrer pour ne garder que les groupes non vides
  const visibleGroups = useMemo(() => {
    return READING_STATUSES.filter((status) => {
      const groupBooks = groupedBooks[status];
      return groupBooks && groupBooks.length > 0;
    });
  }, [groupedBooks]);

  const handleBookPress = (book: Book) => {
    if (!book.id) return;
    router.push({
      pathname: '/book-detail',
      params: { bookId: book.id.toString(), bookTitle: book.title }
    });
  };

  return (
    <BlockWrapper blockKey="library" onRemove={onRemove}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <AppText variant="bodySmall" color="tertiary" style={styles.loadingText}>
            Chargement des livres...
          </AppText>
        </View>
      ) : visibleGroups.length > 0 ? (
        <View style={styles.container}>
          {visibleGroups.map((status) => {
            const groupBooks = groupedBooks[status];
            if (!groupBooks || groupBooks.length === 0) return null;

            const displayBooks = groupBooks.slice(0, maxBooksPerStatus);

            return (
              <View key={status} style={styles.statusSection}>
                {showStatus && groupBooks.length > 0 && (
                  <AppText
                    variant="bodySmall"
                    weight="semibold"
                    color="secondary"
                    style={styles.statusTitle}
                  >
                    {STATUS_LABELS[status]}
                  </AppText>
                )}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.booksContainer}
                >
                  {displayBooks.map((book, index) => (
                    <TouchableOpacity
                      key={book.id || index}
                      style={styles.bookItem}
                      onPress={preventDoublePress(() => handleBookPress(book), 500)}
                      activeOpacity={0.7}
                    >
                      <BookCover
                        uri={book.cover}
                        width={90}
                        height={135}
                        borderRadius={8}
                        fallbackIcon="bookOpen"
                        style={styles.bookCover}
                      />
                      <AppText
                        variant="caption"
                        weight="medium"
                        numberOfLines={2}
                        style={styles.bookTitle}
                      >
                        {book.title}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </View>
      ) : (
        <AppText
          variant="bodySmall"
          color="tertiary"
          style={styles.placeholderText}
        >
          {"Cet utilisateur n'a pas encore de livres dans sa bibliothèque."}
        </AppText>
      )}
    </BlockWrapper>
  );
};

LibraryBlock.displayName = 'LibraryBlock';

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    textAlign: 'center',
  },
  statusSection: {
    gap: 8,
  },
  statusTitle: {
    marginLeft: 4,
  },
  booksContainer: {
    gap: 12,
    paddingRight: 16,
  },
  bookItem: {
    width: 90,
    gap: 6,
  },
  bookCover: {
    borderRadius: 8,
  },
  bookTitle: {
    textAlign: 'center',
  },
  placeholderText: {
    textAlign: 'center',
    marginVertical: 16,
  },
});
