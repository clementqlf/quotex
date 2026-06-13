import { useTabIndex } from '@/src/app/providers/TabContext';
import { useRouter } from 'expo-router';
import { Bookmark, Heart, MessageCircle, Share2, TrendingUp, Zap } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/src/app/providers/ThemeContext';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { ThemeColors } from '@/src/shared/theme';

export default function SocialFeedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { quotes, toggleLikeQuote, toggleSaveQuote, refreshQuotes } = useQuote();
  const feedQuotes = quotes.filter(q => q.user && q.user.id !== "1"); // Global quotes except mine

  const { tabIndex } = useTabIndex();
  const isFocused = tabIndex === 2;

  useEffect(() => {
    if (isFocused) {
      refreshQuotes();
    }
  }, [isFocused, refreshQuotes]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  const FeedQuoteCard = ({ quote }: { quote: any }) => {
    return (
      <View style={styles.quoteCard}>
        {/* User Info - Cliquable */}
        <TouchableOpacity
          style={styles.userInfo}
          activeOpacity={0.7}
          onPress={() => {
            router.push({ 
              pathname: '/user-profile', 
              params: { 
                username: quote.user?.username
              } 
            });
          }}
          accessible={true}
          accessibilityLabel={`Profil de ${quote.user?.name}`}
          accessibilityRole="button"
          testID={`user-profile-${quote.user?.username}`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(quote.user?.name || 'A')}</Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{quote.user?.name}</Text>
            <Text style={styles.userMeta}>
              @{quote.user?.username} · {quote.time || quote.date}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Quote content - clickable */}
        <Pressable
          onPress={() => router.push({ pathname: '/quote-detail', params: { quoteId: quote.id } })}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          accessible={true}
          accessibilityLabel={`Citation de ${quote.user?.name} : ${quote.text}`}
          testID={`quote-detail-pressable-${quote.id}`}
        >
          <View style={styles.quoteContent}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                fill="#20B8CD"
                opacity={0.2}
              />
            </Svg>
            <Text style={styles.quoteText}>{quote.text}</Text>

            {/* Book Tag */}
            <View style={styles.bookTag}>
              <Text style={styles.bookName}>{getBookTitle(quote.book)}</Text>
              <Text style={styles.separator}>·</Text>
              <Text style={styles.authorName}>{getAuthorName(quote.author)}</Text>
            </View>
          </View>
        </Pressable>

        {/* Actions */}
        <View style={styles.actions}>
          <View style={styles.actionsLeft}>
            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.7}
              onPress={() => toggleLikeQuote(quote.id)}
              accessible={true}
              accessibilityLabel={`Aimer la citation de ${quote.user?.name}. Actuellement ${quote.likesCount} j'aime`}
              accessibilityRole="button"
              testID={`like-button-${quote.id}`}
            >
              <Heart
                size={20}
                fill={quote.isLiked ? colors.primary : 'transparent'}
                color={quote.isLiked ? colors.primary : colors.textTertiary}
              />
              <Text
                style={[
                  styles.actionText,
                  quote.isLiked && styles.actionTextActive,
                ]}
              >
                {quote.likesCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel={`Commenter la citation de ${quote.user?.name}. Actuellement ${quote.comments} commentaires`}
              accessibilityRole="button"
              testID={`comment-button-${quote.id}`}
            >
              <MessageCircle size={20} color={colors.textTertiary} />
              <Text style={styles.actionText}>{quote.comments}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel="Partager"
              accessibilityRole="button"
              testID={`share-button-${quote.id}`}
            >
              <Share2 size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => toggleSaveQuote(quote.id)}
            activeOpacity={0.7}
            accessible={true}
            accessibilityLabel="Enregistrer dans ma collection"
            accessibilityRole="button"
            testID={`save-button-${quote.id}`}
          >
            <Bookmark
              fill={quote.isSaved ? colors.primary : 'transparent'}
              size={20}
              color={quote.isSaved ? colors.primary : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TrendingUp size={24} color="#20B8CD" />
            <Text style={styles.headerTitle}>Feed</Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            accessible={true}
            accessibilityLabel="Découvrir"
            accessibilityRole="button"
            testID="discover-button"
          >
            <Zap size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={styles.tabActive}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: true }}
            accessibilityLabel="Tendances"
            testID="tab-trends"
          >
            <Text style={styles.tabTextActive}>Tendances</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tabInactive}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: false }}
            accessibilityLabel="Suivis"
            testID="tab-following"
          >
            <Text style={styles.tabTextInactive}>Suivis</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {feedQuotes.map((quote) => (
          <FeedQuoteCard key={quote.id} quote={quote} />
        ))}
      </ScrollView>

      {/* Floating Refresh Button */}
      <TouchableOpacity
        style={styles.fab}
        accessible={true}
        accessibilityLabel="Rafraîchir"
        accessibilityRole="button"
        testID="refresh-feed-button"
      >
        <TrendingUp size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    color: colors.text,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tabActive: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    alignItems: 'center',
  },
  tabInactive: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    alignItems: 'center',
  },
  tabTextActive: {
    fontSize: 14,
    color: colors.primary,
  },
  tabTextInactive: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 96,
  },
  quoteCard: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    color: colors.primary,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    color: colors.text,
  },
  userMeta: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  quoteContent: {
    marginBottom: 12,
  },
  quoteIcon: {
    fontSize: 24,
    color: 'rgba(32, 184, 205, 0.2)',
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 12,
  },
  bookTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  bookName: {
    fontSize: 12,
    color: colors.primary,
  },
  separator: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  authorName: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  actionsLeft: {
    flexDirection: 'row',
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  actionTextActive: {
    color: colors.primary,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});