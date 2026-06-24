import { useTheme } from '@/src/app/providers/ThemeContext';
import { TOUR_STEPS, useAppTourState } from '@/src/shared/stores/appTourStore';
import { Quote } from '@/src/shared/api/types';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { formatRelativeDate } from '@/src/shared/lib/dateUtils';
import { useAuthorRealtime, useBookRealtime } from '@/src/shared/lib/hooks/useRealtimeEntity';
import { useHaptics } from '@/src/shared/platform';
import { ThemeColors } from '@/src/shared/theme';
import { TypingText } from '@/src/shared/ui/TypingText';
import { useRouter } from 'expo-router';
import { Heart, MoreVertical, Share2 } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import EnrichingSkeleton from './EnrichingSkeleton';

interface QuoteCardProps {
  quote: Quote;
  onToggleLike: (id: number) => void;
  onOpenMenu: (quote: Quote) => void;
  showSavedDate?: boolean; // Afficher savedAt au lieu de date (pour les quotes sauvegardées)
}

const isEnriching = (item: any): boolean => {
  if (item && typeof item === 'object') return !!item.isEnriching;
  return false;
};

const QuoteCard = React.memo(({ quote, onToggleLike, onOpenMenu, showSavedDate }: QuoteCardProps) => {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { currentStepIndex, nextStep } = useAppTourState();
  const haptics = useHaptics();

  // Utiliser Realtime pour obtenir les versions à jour (avec fallback polling)
  const bookId = typeof quote.book === 'object' && quote.book !== null ? quote.book.id : undefined;
  const authorId = typeof quote.author === 'object' && quote.author !== null ? quote.author.id : undefined;
  const realtimeBook = useBookRealtime(bookId, typeof quote.book === 'object' ? quote.book : null);
  const realtimeAuthor = useAuthorRealtime(authorId, typeof quote.author === 'object' ? quote.author : null);

  // Offline citations save book/author as strings initially.
  // When they become objects, use the realtime hook's state, but fall back to the object itself during the transition frame.
  const book = realtimeBook || quote.book;
  const author = realtimeAuthor || quote.author;

  const isBookEnriching = isEnriching(book);
  const isAuthorEnriching = isEnriching(author);



  const handleShare = useCallback(async () => {
    try {
      const authorName = getAuthorName(quote.author);
      const message = `"${quote.text}"\n- ${authorName}\n(via Quotex)`;
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [quote.text, quote.author]);

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.quoteCard}>
        {/* 3-Dots Menu Button - Top Left */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={(e) => {
            e.stopPropagation();
            onOpenMenu(quote);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel="Plus d'options pour cette citation"
          accessibilityRole="button"
          testID="quote-more-options"
        >
          <MoreVertical size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <Pressable
          onPress={() => {
            const activeStepName = TOUR_STEPS[currentStepIndex];
            const params: any = { quoteId: quote.id.toString() };
            if (showSavedDate) {
              params.showSavedDate = 'true';
            }
            if (activeStepName === 'quoteCardDetail') {
              nextStep();
              params.fromTour = 'true';
            }
            router.navigate({ pathname: '/quote-detail', params });
          }}
          onLongPress={async () => {
            try {
              await haptics.impactAsync('medium');
            } catch (err) {
              console.warn('Haptics failed', err);
            }
            onOpenMenu(quote);
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
        >
          {/* Quote Icon (custom SVG) */}
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" style={styles.quoteIcon}>
            <Path
              d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
              fill={colors.primary}
              opacity={0.12}
            />
          </Svg>

          {/* Quote Text */}
          <Text style={styles.quoteText}>{quote.text}</Text>

          {/* Book Info */}
          <View style={styles.bookInfo}>
            <View style={styles.bookInfoLeft}>
              {isBookEnriching && !getBookTitle(book) ? (
                <EnrichingSkeleton width={140} />
              ) : (
                <TypingText
                  text={getBookTitle(book) || ''}
                  originalText={quote.syncCorrections?.book?.original}
                  isCorrected={!!quote.syncCorrections?.book}
                  style={[styles.bookTitle, { color: colors.text }]}
                />
              )}

              {isAuthorEnriching && !getAuthorName(author) ? (
                <EnrichingSkeleton width={80} height={12} />
              ) : (
                <TypingText
                  text={getAuthorName(author) || ''}
                  originalText={quote.syncCorrections?.author?.original}
                  isCorrected={!!quote.syncCorrections?.author}
                  style={[styles.authorName, { color: colors.primary }]}
                />
              )}
            </View>
            <Text style={styles.dateText}>{formatRelativeDate(showSavedDate && quote.savedAt ? quote.savedAt : quote.date)}</Text>
          </View>
        </Pressable>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onToggleLike(quote.id)}
            accessible={true}
            accessibilityLabel={`Aimer la citation. Nombre de j'aime actuel : ${quote.likesCount}`}
            accessibilityRole="button"
            testID="quote-like-button"
          >
            <Heart
              size={20}
              color={quote.isLiked ? colors.primary : colors.textTertiary}
              fill={quote.isLiked ? colors.primary : 'none'}
            />
            <Text style={[styles.actionText, quote.isLiked && styles.actionTextActive]}>
              {quote.likesCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
            accessible={true}
            accessibilityLabel="Partager la citation"
            accessibilityRole="button"
            testID="quote-share-button"
          >
            <Share2 size={20} color={colors.textTertiary} />
            <Text style={styles.actionText}>Partager</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

QuoteCard.displayName = 'QuoteCard';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  cardWrapper: {
    width: '100%',
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
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
  quoteIcon: {
    color: 'rgba(32, 184, 205, 0.2)',
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.text,
    marginBottom: 16,
    fontFamily: 'Times New Roman',
    fontStyle: 'italic',
    fontWeight: '100',
  },
  bookInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHighlight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookInfoLeft: {
    flex: 1,
    marginRight: 12,
  },
  bookTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  authorName: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actionTextActive: {
    color: colors.primary,
  },
});

export default QuoteCard;
