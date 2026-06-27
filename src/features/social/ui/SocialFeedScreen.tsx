import { useTabIndex } from '@/src/app/providers/TabContext';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Bookmark, Heart, MessageCircle, Share2, Sparkles, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
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
import { UserAvatar } from '@/src/entities/user/ui/UserAvatar';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { Quote } from '@/src/shared/api/types';
import { ThemeColors } from '@/src/shared/theme';

export default function SocialFeedScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { quotes, toggleLikeQuote, toggleSaveQuote, refreshQuotes, isLoading } = useQuote();
  const feedQuotes = quotes.filter(q => q.user && q.user.id !== "1"); // Global quotes except mine

  const { tabIndex } = useTabIndex();
  const isFocused = tabIndex === 2;

  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    if (isFocused) {
      refreshQuotes();
    }
  }, [isFocused, refreshQuotes]);



  const FeedQuoteCard = ({ quote }: { quote: Quote }) => {
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
          <UserAvatar
            user={quote.user}
            size={40}
            style={styles.avatar}
          />
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
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshQuotes}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {feedQuotes.map((quote) => (
          <FeedQuoteCard key={quote.id} quote={quote} />
        ))}
      </ScrollView>
      {showOverlay && (
        <View style={styles.overlayContainer} pointerEvents="auto">
          <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill}>
            <View style={styles.blurContent}>
              <View style={styles.glassCard}>
                <View style={styles.iconWrapper}>
                  <MessageCircle size={40} color={colors.primary} />
                  <Sparkles size={20} color={colors.primary} style={styles.miniSparkle} />
                </View>
                <Text style={styles.overlayTitle}>Bientôt disponible</Text>
                <Text style={styles.overlaySubtitle}>
                  {"Le flux social de Quotex arrive bientôt. Vous pourrez partager vos citations favorites, suivre d'autres lecteurs et échanger autour de vos lectures."}
                </Text>
              </View>
            </View>
          </BlurView>
        </View>
      )}
      {__DEV__ && (
        <TouchableOpacity
          style={styles.devFloatingToggleButton}
          onPress={() => setShowOverlay(prev => !prev)}
          accessible={true}
          accessibilityLabel="Masquer ou afficher le voile bientôt disponible"
          accessibilityRole="button"
        >
          <Text style={styles.devToggleText}>
            {showOverlay ? "Masquer Voile" : "Afficher Voile"}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
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
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  devFloatingToggleButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 1100,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  devToggleText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: 'bold',
  },
  blurContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  glassCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: isDark ? 'rgba(26, 26, 26, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: isDark ? 'rgba(32, 184, 205, 0.1)' : 'rgba(32, 184, 205, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  miniSparkle: {
    position: 'absolute',
    top: 15,
    right: 15,
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  overlaySubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});