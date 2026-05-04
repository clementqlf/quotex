import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { TrendingUp, Zap, Heart, MessageCircle, Share2, Bookmark } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useTabIndex } from '@/src/contexts/TabContext';

import { globalQuotesDB } from '../data/staticData';
import { useData } from '@/src/contexts/DataProvider';
import { getBookTitle, getAuthorName } from '@/src/utils/dataHelpers';
import { useTheme } from '@/src/contexts/ThemeContext';
import { ThemeColors } from '@/src/theme/theme';

export default function SocialFeedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { quotes, toggleLikeQuote, toggleSaveQuote, refreshQuotes } = useData();
  const feedQuotes = quotes.filter(q => q.user && q.user.id !== 1); // Global quotes except mine

  const { tabIndex, setTabIndex } = useTabIndex();
  const isFocused = tabIndex === 2;

  useEffect(() => {
    if (isFocused) {
      refreshQuotes();
    }
  }, [isFocused]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
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
          <TouchableOpacity style={styles.headerButton}>
            <Zap size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity style={styles.tabActive}>
            <Text style={styles.tabTextActive}>Tendances</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabInactive}>
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
        {feedQuotes.map((quote) => {
          // On s'assure que l'objet passé à QuoteDetail contient toutes les informations nécessaires,
          // y compris l'objet `user` complet avec son `id`.
          // On mappe aussi `time` vers `date` pour la cohérence.
          const quoteForDetail = { ...quote, date: quote.time, user: quote.user };

          return (
            <TouchableOpacity key={quote.id} style={styles.quoteCard} activeOpacity={0.8} onPress={() => {
              router.push({ pathname: '/quote-detail', params: { quoteId: quote.id } });
            }}>
              {/* User Info - Cliquable */}
              <TouchableOpacity
                style={styles.userInfo}
                onPress={(e) => {
                  e.stopPropagation(); // Empêche le clic de se propager à la carte parente
                  router.push({ 
                    pathname: '/user-profile', 
                    params: { 
                      username: quote.user?.username
                    } 
                  });
                }}
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

              {/* Quote */}
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

              {/* Actions */}
              <View style={styles.actions}>
                <View style={styles.actionsLeft}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => toggleLikeQuote(quote.id)}
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

                  <TouchableOpacity style={styles.actionButton}>
                    <MessageCircle size={20} color={colors.textTertiary} />
                    <Text style={styles.actionText}>{quote.comments}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Share2 size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => toggleSaveQuote(quote.id)}>
                  <Bookmark
                    fill={quote.isSaved ? colors.primary : 'transparent'}
                    size={20}
                    color={quote.isSaved ? colors.primary : colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Floating Refresh Button */}
      <TouchableOpacity style={styles.fab}>
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