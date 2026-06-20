import { useTheme } from '@/src/app/providers/ThemeContext';
import { getStatusColor, getStatusLabel } from '@/src/shared/lib/dataHelpers';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors } from '@/src/shared/theme';
import { TypingText } from '@/src/shared/ui/TypingText';
import { Image } from 'expo-image';
import { CheckCircle2, MoreVertical, PlusCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useHaptics } from '@/src/shared/platform';

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
  isSaved?: boolean;
}

interface BookCardItemProps {
  book: BookCardData;
  onOpenMenu?: (book: BookCardData) => void;
  onPress?: () => void;
  showDescription?: boolean;
  showAddButton?: boolean;
  onAddPress?: () => void;
  onAddLongPress?: () => void;
}

const BookCardItem = React.memo(({ book, onOpenMenu, onPress, showDescription = true, showAddButton, onAddPress, onAddLongPress }: BookCardItemProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { navigateToBook } = useSmartNavigation();
  const haptics = useHaptics();

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
      onPress={onPress || (() => navigateToBook(book.id ?? book.title, book.inventaireUri))}
    >
      <View style={styles.bookCardContent}>
        {book.cover ? (
          <Image source={{ uri: book.cover }} style={styles.bookCardCover} />
        ) : (
          <View style={styles.bookCardCoverPlaceholder} />
        )}
        <View style={[styles.bookCardInfo, (onOpenMenu || showAddButton) ? { paddingRight: 28 } : null]}>
          <View style={styles.bookCardHeader}>
            <TypingText style={styles.bookCardTitle} text={book.title} />
            {typeof book.year === 'number' && <Text style={styles.bookCardYear}>{book.year}</Text>}
          </View>
          <View style={styles.authorRow}>
            <TypingText 
              style={styles.bookCardAuthor} 
              numberOfLines={1}
              text={book.authors.length > 0 ? book.authors.join(', ') : 'Auteur inconnu'}
            />
            {book.readingStatus && statusStyle && (
              <View style={[styles.statusBadge, statusStyle]}>
                <Text style={[styles.statusText, { color: getStatusColor(book.readingStatus) }]}>
                  {getStatusLabel(book.readingStatus)}
                </Text>
              </View>
            )}
          </View>
          {showDescription && book.description && <Text numberOfLines={3} style={styles.bookCardDescription}>{book.description}</Text>}
          <Text style={styles.bookCardCount}>{book.quoteCount} citation{book.quoteCount > 1 ? 's' : ''}</Text>
        </View>
      </View>

      {onOpenMenu && (
        <TouchableOpacity
          style={styles.menuButton}
          onPress={(e) => {
            e.stopPropagation();
            onOpenMenu(book);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel="Plus d'options pour ce livre"
          accessibilityRole="button"
          testID="book-more-options"
        >
          <MoreVertical size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      )}

      {showAddButton && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={(e) => {
            e.stopPropagation();
            if (onAddPress) {
              onAddPress();
            }
          }}
          onLongPress={async (e) => {
            e.stopPropagation();
            try {
              await haptics.impactAsync('medium');
            } catch (err) {
              console.warn('Haptics failed', err);
            }
            if (onAddLongPress) {
              onAddLongPress();
            }
          }}
          delayLongPress={400}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel={book.isSaved ? "Retirer ce livre de ma bibliothèque" : "Ajouter ce livre à ma bibliothèque"}
          accessibilityRole="button"
          testID="book-add-library"
        >
          {book.isSaved ? (
            <CheckCircle2 size={22} color={colors.success || '#4CAF50'} />
          ) : (
            <PlusCircle size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      )}
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
    position: 'relative', // ensure absolute positioning of menu button works relative to bookCard
  },
  menuButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
    height: 22,
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
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export { BookCardData };
export default BookCardItem;
