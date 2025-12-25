import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Quote as QuoteIcon, Heart, ChevronLeft } from 'lucide-react-native';
import { useData } from '../src/contexts/DataProvider';
import { Quote } from '../types';
import { getAuthorName, getBookTitle } from '../src/utils/dataHelpers';

type ThemeDetailScreenRouteProp = RouteProp<{ params: { themeName: string } }, 'params'>;

export function ThemeDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ThemeDetailScreenRouteProp>();
  const themeName = route.params?.themeName;

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

  // Filtrer les citations par thème (sur toutes les citations dynamiques)
  const themeQuotes = allQuotes.filter(q => (q.theme || 'Thème non renseigné') === themeName);


  const openQuoteDetail = (quote: Quote) => {
    navigation.navigate('QuoteDetail', { quote });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
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
                <QuoteIcon size={16} color="#20B8CD" />
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
                            color={quote.isLiked ? "#EF4444" : "#6B7280"}
                            fill={quote.isLiked ? "#EF4444" : "none"}
                          />
                          <Text style={styles.likeCount}>{quote.likes}</Text>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0F0F' },
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', flex: 1, textAlign: 'center' },
  placeholder: { width: 28 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },

  themeInfoSection: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
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
    backgroundColor: '#20B8CD22',
    borderWidth: 2,
    borderColor: '#20B8CD44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeIcon: {
    color: '#20B8CD',
    fontWeight: 'bold',
    fontSize: 28,
  },
  themeInfoContent: {
    flex: 1,
  },
  themeNameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  themeCountText: {
    fontSize: 14,
    color: '#6B7280',
  },

  section: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
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
    color: '#FFFFFF',
  },

  quotesList: {
    gap: 12,
  },
  quoteCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 12,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#E5E7EB',
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
    color: '#20B8CD',
    fontWeight: '500',
    marginBottom: 2,
  },
  quoteBook: {
    fontSize: 11,
    color: '#6B7280',
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
    backgroundColor: '#1F1F1F',
  },
  likeCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 32,
  },

  errorText: { color: 'white', textAlign: 'center', marginTop: 50 },
});
