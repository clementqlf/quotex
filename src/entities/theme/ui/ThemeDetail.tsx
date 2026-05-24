import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Quote as QuoteIcon, Heart, ChevronLeft } from 'lucide-react-native';
import { useData } from '@/src/app/providers/DataProvider';
import { Quote } from '@/src/shared/api/types';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

export default function ThemeDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const router = useRouter();
  const { themeName } = useLocalSearchParams<{ themeName: string }>();

  const { quotes: allQuotes, toggleLikeQuote } = useData();

  if (!themeName) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Thème non trouvé.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Filtrer les citations par thème (sur toutes les citations dynamiques incluant les thèmes secondaires)
  const themeQuotes = allQuotes.filter(q => {
    const qTheme = q.theme;
    const additionalThemes = q.blockData?.additionalThemes || [];
    const allThemes = Array.from(new Set([qTheme, ...additionalThemes].filter(Boolean)));
    if (allThemes.length === 0) {
      allThemes.push('Thème non renseigné');
    }
    return allThemes.includes(themeName);
  });


  const openQuoteDetail = (quote: Quote) => {
    router.navigate({ pathname: '/quote-detail', params: { quote: JSON.stringify(quote) } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{themeName}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Theme Info */}
          <View style={styles.themeInfoSection}>
            <View style={styles.themeIconContainer}>
              <Text style={styles.themeIcon}>{themeName[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.themeInfoContent}>
              <Text style={styles.themeNameText}>{themeName}</Text>
              <Text style={styles.themeCountText}>{themeQuotes.length} citation{themeQuotes.length !== 1 ? 's' : ''} trouvée{themeQuotes.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {/* Quotes List */}
          {themeQuotes.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <QuoteIcon size={16} color={colors.primary} />
                <Text style={styles.sectionTitle}>Citations du thème</Text>
              </View>
              <View style={styles.quotesList}>
                {themeQuotes.map(quote => (
                  <TouchableOpacity
                    key={quote.id}
                    style={styles.quoteCard}
                    activeOpacity={0.85}
                    onPress={() => openQuoteDetail(quote)}
                  >
                    <Text style={styles.quoteText}>"{quote.text}"</Text>
                    <View style={styles.quoteMeta}>
                      <View style={styles.quoteMetaLeft}>
                        <Text style={styles.quoteAuthor}>{getAuthorName(quote.author)}</Text>
                        <Text style={styles.quoteBook}>{getBookTitle(quote.book)}</Text>
                      </View>
                      <View style={styles.quoteMetaRight}>
                        <TouchableOpacity
                          style={styles.likeButton}
                          onPress={() => toggleLikeQuote(quote.id)}
                        >
                          <Heart
                            size={16}
                            color={quote.isLiked ? colors.warning : colors.textTertiary}
                            fill={quote.isLiked ? colors.warning : "none"}
                          />
                          <Text style={styles.likeCount}>{quote.likesCount}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyStateText}>Aucune citation trouvée pour ce thème.</Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center' },
  placeholder: { width: 28 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },

  themeInfoSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  themeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeIcon: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 28,
  },
  themeInfoContent: {
    flex: 1,
  },
  themeNameText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  themeCountText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  quotesList: {
    gap: 12,
  },
  quoteCard: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  quoteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quoteMetaLeft: {
    flex: 1,
  },
  quoteAuthor: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  quoteBook: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  quoteMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  likeCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: 32,
  },

  errorText: { color: colors.text, textAlign: 'center', marginTop: 50 },
});
