import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { getStatusColor, getStatusLabel } from '@/src/shared/lib/dataHelpers';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';

interface BookCardData {
  title: string;
  id?: number;
  authors: string[];
  quoteCount: number;
  year?: number;
  description?: string;
  cover?: string;
  readingStatus?: string | null;
  inventaireUri?: string;
}

interface BookCardItemProps {
  book: BookCardData;
}

const BookCardItem = React.memo(({ book }: BookCardItemProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { navigateToBook } = useSmartNavigation();

  const statusStyle = useMemo(() => {
    if (!book.readingStatus) return null;
    return {
      backgroundColor: getStatusColor(book.readingStatus) + '15',
      borderColor: getStatusColor(book.readingStatus) + '40',
    };
  }, [book.readingStatus]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.bookCard,
        { opacity: pressed ? 0.85 : 1 }
      ]}
      onPress={() => navigateToBook(book.id ?? book.title, book.inventaireUri)}
    >
      <View style={styles.bookCardContent}>
        {book.cover ? (
          <Image source={{ uri: book.cover }} style={styles.bookCardCover} />
        ) : (
          <View style={styles.bookCardCoverPlaceholder} />
        )}
        <View style={styles.bookCardInfo}>
          <View style={styles.bookCardHeader}>
            <Text style={styles.bookCardTitle}>{book.title}</Text>
            {typeof book.year === 'number' && <Text style={styles.bookCardYear}>{book.year}</Text>}
          </View>
          <View style={styles.authorRow}>
            <Text style={styles.bookCardAuthor} numberOfLines={1}>
              {book.authors.length > 0 ? book.authors.join(', ') : 'Auteur inconnu'}
            </Text>
            {book.readingStatus && statusStyle && (
              <View style={[styles.statusBadge, statusStyle]}>
                <Text style={[styles.statusText, { color: getStatusColor(book.readingStatus) }]}>
                  {getStatusLabel(book.readingStatus)}
                </Text>
              </View>
            )}
          </View>
          {book.description && <Text numberOfLines={3} style={styles.bookCardDescription}>{book.description}</Text>}
          <Text style={styles.bookCardCount}>{book.quoteCount} citation{book.quoteCount > 1 ? 's' : ''}</Text>
        </View>
      </View>
    </Pressable>
  );
});

BookCardItem.displayName = 'BookCardItem';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  bookCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    overflow: 'hidden',
  },
  bookCardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  bookCardCover: {
    width: 60,
    height: 90,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: colors.surfaceHighlight,
  },
  bookCardCoverPlaceholder: {
    width: 60,
    height: 90,
    borderRadius: 4,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHighlight,
  },
  bookCardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  bookCardTitle: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  bookCardYear: {
    fontSize: 12,
    color: colors.textTertiary,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  bookCardAuthor: {
    fontSize: 14,
    color: colors.primary,
    flex: 1,
  },
  bookCardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  bookCardCount: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export { BookCardData };
export default BookCardItem;
