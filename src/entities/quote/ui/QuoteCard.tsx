import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Share,
  StyleSheet,
} from 'react-native';
import { Heart, Share2, MoreVertical, CheckCircle2 } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Quote } from '@/src/shared/api/types';
import { getBookTitle, getAuthorName } from '@/src/shared/lib/dataHelpers';
import { formatRelativeDate } from '@/src/shared/lib/dateUtils';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import EnrichingSkeleton from './EnrichingSkeleton';
import { useBookRealtime, useAuthorRealtime } from '@/src/shared/lib/hooks/useRealtimeEntity';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { supabase } from '@/src/shared/api/supabase';
import { TypingText } from '@/src/shared/ui/TypingText';

interface QuoteCardProps {
  quote: Quote;
  onToggleLike: (id: number) => void;
  onOpenMenu: (quote: Quote) => void;
}

const isEnriching = (item: any): boolean => {
  if (item && typeof item === 'object') return !!item.isEnriching;
  return false;
};

const QuoteCard = React.memo(({ quote, onToggleLike, onOpenMenu }: QuoteCardProps) => {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Utiliser Realtime pour obtenir les versions à jour (avec fallback polling)
  const book = useBookRealtime(quote.book?.id, quote.book);
  const author = useAuthorRealtime(quote.author?.id, quote.author);

  const isBookEnriching = isEnriching(book);
  const isAuthorEnriching = isEnriching(author);

  // Animation pour le titre du livre
  const bookTitleScale = useSharedValue(1);
  const bookTitleOpacity = useSharedValue(1);
  const bookTitleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bookTitleScale.value }],
    opacity: bookTitleOpacity.value,
  }));

  // Animation pour le nom de l'auteur
  const authorScale = useSharedValue(1);
  const authorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: authorScale.value }],
  }));

  // Détecter les changements de titre/nom et déclencher les animations
  const prevBookTitle = useRef(getBookTitle(quote.book));
  const prevAuthorName = useRef(getAuthorName(quote.author));

  useEffect(() => {
    const currentTitle = getBookTitle(book);
    const prevTitle = prevBookTitle.current;
    
    if (currentTitle && currentTitle !== prevTitle && prevTitle) {
      // Animation: petit zoom + fade
      bookTitleScale.value = withSequence(
        withTiming(1.1, { duration: 150 }),
        withSpring(1, { damping: 10, stiffness: 400 })
      );
      bookTitleOpacity.value = withSequence(
        withTiming(0.7, { duration: 100 }),
        withTiming(1, { duration: 200 })
      );
      prevBookTitle.current = currentTitle;
    }
  }, [book, bookTitleScale, bookTitleOpacity]);

  useEffect(() => {
    const currentName = getAuthorName(author);
    const prevName = prevAuthorName.current;
    
    if (currentName && currentName !== prevName && prevName) {
      // Animation: petit zoom
      authorScale.value = withSequence(
        withTiming(1.05, { duration: 150 }),
        withSpring(1, { damping: 10, stiffness: 400 })
      );
      prevAuthorName.current = currentName;
    }
  }, [author, authorScale]);

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
        >
          <MoreVertical size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <Pressable
          onPress={() => router.navigate({ pathname: '/quote-detail', params: { quoteId: quote.id } })}
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
                <Animated.View style={bookTitleAnimatedStyle}>
                  {quote.syncCorrections?.book ? (
                    <TypingText
                      text={getBookTitle(book) || ''}
                      originalText={quote.syncCorrections.book.original}
                      isCorrected={true}
                      style={[styles.bookTitle, { color: colors.text }]}
                    />
                  ) : (
                    <Text style={[styles.bookTitle, { color: colors.text }]}>
                      {getBookTitle(book)}
                    </Text>
                  )}
                </Animated.View>
              )}

              {isAuthorEnriching && !getAuthorName(author) ? (
                <EnrichingSkeleton width={80} height={12} />
              ) : (
                <Animated.View style={authorAnimatedStyle}>
                  {quote.syncCorrections?.author ? (
                    <TypingText
                      text={getAuthorName(author) || ''}
                      originalText={quote.syncCorrections.author.original}
                      isCorrected={true}
                      style={[styles.authorName, { color: colors.primary }]}
                    />
                  ) : (
                    <Text style={[styles.authorName, { color: colors.primary }]}>
                      {getAuthorName(author)}
                    </Text>
                  )}
                </Animated.View>
              )}
            </View>
            <Text style={styles.dateText}>{formatRelativeDate(quote.date)}</Text>
          </View>
        </Pressable>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onToggleLike(quote.id)}
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
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
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
