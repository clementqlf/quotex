import { useTabIndex } from '@/src/app/providers/TabContext';
import { BlurView } from 'expo-blur';
import { useRouter } from '@/src/shared/navigation/useRouter';
import { useSinglePress } from '@/src/shared/lib/pressUtils';
import { Bookmark, Heart, MessageCircle, Share2, Sparkles, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
  InteractionManager
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AppText, Avatar, Card, TabBar, Button, IconButton, Badge } from '@/src/shared/ui';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { Quote } from '@/src/shared/api/types';
import { ThemeColors } from '@/src/shared/theme';

const FEED_TABS = [
  { id: 'trends', label: 'Tendances' },
  { id: 'following', label: 'Suivis' }
];

export default function SocialFeedScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { quotes, toggleLikeQuote, toggleSaveQuote, refreshQuotes, isLoading } = useQuote();
  const feedQuotes = quotes.filter(q => q.user && q.user.id !== "1"); // Global quotes except mine

  const { tabIndex } = useTabIndex();
  const isFocused = tabIndex === 2;

  const [activeTab, setActiveTab] = useState<'trends' | 'following'>('trends');
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    if (isFocused) {
      const task = InteractionManager.runAfterInteractions(() => {
        refreshQuotes();
      });
      return () => task.cancel();
    }
  }, [isFocused, refreshQuotes]);

  const FeedQuoteCard = ({ quote }: { quote: Quote }) => {
    const handleUserPress = useSinglePress(() => {
      router.push({ 
        pathname: '/user-profile', 
        params: { 
          username: quote.user?.username 
        } 
      });
    }, 500, [quote.user?.username]);

    const handleQuotePress = useSinglePress(() => {
      router.push({ pathname: '/quote-detail', params: { quoteId: quote.id } });
    }, 500, [quote.id]);

    return (
      <Card variant="flat" padding="md" style={styles.quoteCard}>
        <TouchableOpacity
          style={styles.userInfo}
          activeOpacity={0.7}
          onPress={handleUserPress}
          accessible={true}
          accessibilityLabel={`Profil de ${quote.user?.name}`}
          accessibilityRole="button"
          testID={`user-profile-${quote.user?.username}`}
        >
          <Avatar
            user={quote.user}
            size={40}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <AppText style={styles.userName}>{quote.user?.name}</AppText>
            <AppText style={styles.userMeta}>
              @{quote.user?.username} · {quote.time || quote.date}
            </AppText>
          </View>
        </TouchableOpacity>

        <Pressable
          onPress={handleQuotePress}
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
            <AppText style={styles.quoteText}>{quote.text}</AppText>

            <Badge variant="outline">
              <AppText style={styles.bookName}>{getBookTitle(quote.book)}</AppText>
              <AppText style={styles.separator}>·</AppText>
              <AppText style={styles.authorName}>{getAuthorName(quote.author)}</AppText>
            </Badge>
          </View>
        </Pressable>

        <View style={styles.actions}>
          <View style={styles.actionsLeft}>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={
                <Heart
                  size={20}
                  fill={quote.isLiked ? colors.primary : 'transparent'}
                  color={quote.isLiked ? colors.primary : colors.textTertiary}
                />
              }
              onPress={() => toggleLikeQuote(quote.id)}
              title={quote.likesCount.toString()}
              textStyle={quote.isLiked ? styles.actionTextActive : styles.actionText}
              accessibilityLabel={`Aimer la citation de ${quote.user?.name}. Actuellement ${quote.likesCount} j'aime`}
              testID={`like-button-${quote.id}`}
            />

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<MessageCircle size={20} color={colors.textTertiary} />}
              title={(quote.comments || 0).toString()}
              textStyle={styles.actionText}
              accessibilityLabel={`Commenter la citation de ${quote.user?.name}. Actuellement ${quote.comments} commentaires`}
              testID={`comment-button-${quote.id}`}
            />

            <IconButton
              variant="ghost"
              size="sm"
              icon={<Share2 size={20} color={colors.textTertiary} />}
              accessibilityLabel="Partager"
              testID={`share-button-${quote.id}`}
            />
          </View>

          <IconButton
            variant="ghost"
            size="sm"
            icon={
              <Bookmark
                fill={quote.isSaved ? colors.primary : 'transparent'}
                size={20}
                color={quote.isSaved ? colors.primary : colors.textTertiary}
              />
            }
            onPress={() => toggleSaveQuote(quote.id)}
            accessibilityLabel="Enregistrer dans ma collection"
            testID={`save-button-${quote.id}`}
          />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TrendingUp size={24} color="#20B8CD" />
            <AppText style={styles.headerTitle}>Feed</AppText>
          </View>
        </View>

        <TabBar
          tabs={FEED_TABS}
          activeTab={activeTab}
          onTabPress={(tabId) => setActiveTab(tabId as 'trends' | 'following')}
          style={styles.tabs}
        />
      </View>

      <View style={styles.scrollView}>
        <FlashList
          data={feedQuotes}
          renderItem={({ item }) => <FeedQuoteCard quote={item} />}
          keyExtractor={(item) => item.id.toString()}
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
        />
      </View>
      {showOverlay && (
        <View style={styles.overlayContainer} pointerEvents="auto">
          <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill}>
            <View style={styles.blurContent}>
              <View style={styles.glassCard}>
                <View style={styles.iconWrapper}>
                  <MessageCircle size={40} color={colors.primary} />
                  <Sparkles size={20} color={colors.primary} style={styles.miniSparkle} />
                </View>
                <AppText variant="h1" style={styles.overlayTitle}>Bientôt disponible</AppText>
                <AppText style={styles.overlaySubtitle}>
                  {"Le flux social de Quotex arrive bientôt. Vous pourrez partager vos citations favorites, suivre d'autres lecteurs et échanger autour de vos lectures."}
                </AppText>
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
          <AppText style={styles.devToggleText}>
            {showOverlay ? "Masquer Voile" : "Afficher Voile"}
          </AppText>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 96,
  },
  quoteCard: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderWidth: 0,
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
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 12,
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

  actionText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  actionTextActive: {
    color: colors.primary,
  },
  tabs: {
    marginBottom: 0,
    borderBottomWidth: 0,
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
