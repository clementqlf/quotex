import { useTheme } from '@/src/app/providers/ThemeContext';
import { getStatusColor, getStatusLabel } from '@/src/shared/lib/dataHelpers';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors, tokens as defaultTokens } from '@/src/shared/theme';
import { AppText, BookCover, TypingText, Badge, IconButton } from '@/src/shared/ui';
import { CheckCircle2, MoreVertical, PlusCircle } from 'lucide-react-native';
import React, { useMemo, useRef, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useHaptics } from '@/src/shared/platform';
import { useSinglePress } from '@/src/shared/lib/pressUtils';

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
  isExternal?: boolean;
  googleId?: string;
  isbn?: string | null;
  pages?: number;
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
  const { colors, tokens = defaultTokens } = useTheme();
  const styles = useMemo(() => createStyles(colors, tokens), [colors, tokens]);
  const { navigateToBook } = useSmartNavigation();
  const haptics = useHaptics();

  const isPressingRef = useRef(false);

  const handlePress = useCallback(() => {
    if (isPressingRef.current) return;
    isPressingRef.current = true;
    setTimeout(() => {
      isPressingRef.current = false;
    }, 1000);

    if (onPress) {
      onPress();
    } else {
      navigateToBook(book.id ?? book.title, book.inventaireUri);
    }
  }, [onPress, navigateToBook, book.id, book.title, book.inventaireUri]);

  const handleMenuPress = useSinglePress(() => {
    if (onOpenMenu) {
      onOpenMenu(book);
    }
  }, 500, [onOpenMenu, book]);

  const handleAddPress = useSinglePress(() => {
    if (onAddPress) {
      onAddPress();
    }
  }, 500, [onAddPress]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.bookCard,
        { opacity: pressed ? 0.85 : 1 }
      ]}
      onPress={handlePress}
      onLongPress={async () => {
        if (onOpenMenu) {
          try {
            await haptics.impactAsync('medium');
          } catch (err) {
            console.warn('Haptics failed', err);
          }
          onOpenMenu(book);
        }
      }}
    >
      <View style={styles.bookCardContent}>
        <BookCover
          uri={book.cover}
          title={book.title}
          width={60}
          height={90}
          fallbackIcon="book"
          showTitleFallback={true}
          style={styles.bookCardCover}
        />
        <View style={[styles.bookCardInfo, (onOpenMenu || showAddButton) ? { paddingRight: 28 } : null]}>
          <View style={styles.bookCardHeader}>
            <TypingText style={styles.bookCardTitle} text={book.title} resetKey={book.id} />
            {typeof book.year === 'number' && <AppText style={styles.bookCardYear}>{book.year}</AppText>}
          </View>
          <View style={styles.authorRow}>
            <TypingText 
              style={styles.bookCardAuthor} 
              numberOfLines={1}
              text={book.authors.length > 0 ? book.authors.join(', ') : 'Auteur inconnu'}
              resetKey={book.id}
            />
            {book.readingStatus && (
              <Badge
                label={getStatusLabel(book.readingStatus)}
                size="sm"
                variant="outline"
                style={{
                  backgroundColor: getStatusColor(book.readingStatus) + '15',
                  borderColor: getStatusColor(book.readingStatus) + '40',
                }}
                textStyle={{ color: getStatusColor(book.readingStatus) }}
              />
            )}
          </View>
          {showDescription && book.description && <AppText numberOfLines={3} style={styles.bookCardDescription}>{book.description}</AppText>}
          <AppText style={styles.bookCardCount}>{book.quoteCount} citation{book.quoteCount > 1 ? 's' : ''}</AppText>
        </View>
      </View>

      {onOpenMenu && (
        <IconButton
          icon={<MoreVertical size={20} color={colors.textTertiary} />}
          variant="ghost"
          size="sm"
          onPress={handleMenuPress}
          style={styles.menuButton}
          accessibilityLabel="Plus d'options pour ce livre"
          testID="book-more-options"
        />
      )}

      {showAddButton && (
        <IconButton
          icon={
            book.isSaved ? (
              <CheckCircle2 size={22} color={colors.success || '#4CAF50'} />
            ) : (
              <PlusCircle size={22} color={colors.primary} />
            )
          }
          variant="ghost"
          size="sm"
          onPress={handleAddPress}
          onLongPress={async (e: any) => {
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
          style={styles.addButton}
          accessibilityLabel={book.isSaved ? "Retirer ce livre de ma bibliothèque" : "Ajouter ce livre à ma bibliothèque"}
          testID="book-add-library"
        />
      )}
    </Pressable>
  );
});

BookCardItem.displayName = 'BookCardItem';

const createStyles = (colors: ThemeColors, tokens: any) => StyleSheet.create({
  bookCard: {
    backgroundColor: colors.surface,
    borderRadius: tokens.radii.md,
    marginBottom: tokens.spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative', // ensure absolute positioning of menu button works relative to bookCard
  },
  menuButton: {
    position: 'absolute',
    top: tokens.spacing.sm + 4,
    right: tokens.spacing.sm + 4,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    position: 'absolute',
    top: '50%',
    right: tokens.spacing.sm + 4,
    transform: [{ translateY: -16 }],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  bookCardContent: {
    flexDirection: 'row',
    padding: tokens.spacing.sm + 4,
  },
  bookCardCover: {
    width: 60,
    height: 90,
    borderRadius: tokens.radii.xs,
    marginRight: tokens.spacing.sm + 4,
    backgroundColor: colors.surfaceHighlight,
  },
  bookCardCoverPlaceholder: {
    width: 60,
    height: 90,
    borderRadius: tokens.radii.xs,
    marginRight: tokens.spacing.sm + 4,
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
    marginBottom: tokens.spacing.xs,
    gap: tokens.spacing.sm,
  },
  bookCardTitle: {
    flex: 1,
    fontSize: tokens.typography.fontSize.xl,
    lineHeight: tokens.typography.lineHeight.lg,
    color: colors.text,
    fontFamily: tokens.typography.fontFamily.display,
    fontWeight: tokens.typography.fontWeight.semibold,
  },
  bookCardYear: {
    fontSize: tokens.typography.fontSize.xs,
    color: colors.textTertiary,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: tokens.radii.xs,
    overflow: 'hidden',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs + 2,
    gap: tokens.spacing.sm,
    height: 22,
  },
  bookCardAuthor: {
    fontSize: tokens.typography.fontSize.sm,
    color: colors.primary,
    fontFamily: tokens.typography.fontFamily.body,
    flex: 1,
  },
  bookCardDescription: {
    fontSize: tokens.typography.fontSize.xs + 1,
    color: colors.textSecondary,
    lineHeight: tokens.typography.lineHeight.xs + 2,
    marginBottom: tokens.spacing.sm,
  },
  bookCardCount: {
    fontSize: tokens.typography.fontSize.xs,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: tokens.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.radii.xs + 2,
    borderWidth: 1,
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: tokens.typography.fontWeight.semibold,
  },
});

export { BookCardData };
export default BookCardItem;
