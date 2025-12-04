import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ChevronLeft, User, Calendar, BookOpen as BookIcon, Star, BookOpen } from 'lucide-react-native';
import { bookDescriptions, authorDescriptions, similarBooks, globalQuotesDB } from '../data/staticData';

type BookDetailScreenRouteProp = RouteProp<{ params: { bookTitle: string } }, 'params'>;

export function BookDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<BookDetailScreenRouteProp>();
  const bookTitle = route.params?.bookTitle;

  const bookInfo = bookDescriptions[bookTitle];

  if (!bookInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.placeholder} />
          </View>
          <Text style={styles.errorText}>Livre non trouvé.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Logique pour trouver les livres similaires
  // 1. Trouver les citations (globales) qui appartiennent au livre actuel.
  const currentBookQuotes = globalQuotesDB
    .filter(q => q.book === bookTitle)
    .map(mq => mq.text);
  // 2. Aplatir les listes de livres similaires pour ces citations et s'assurer qu'ils sont uniques.
  const similarBookList = currentBookQuotes.flatMap(q => similarBooks[q] || []);
  const uniqueSimilarBooks = [...new Set(similarBookList)].filter(b => b !== bookTitle);

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
          <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Book Information */}
          <View style={styles.section}>
            <View style={styles.bookContainer}>
              <Image source={{ uri: bookInfo.cover }} style={styles.bookCoverImage} />
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitleText}>{bookTitle}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AuthorDetail', { authorName: bookInfo.author })}>
                  <Text style={styles.bookAuthorText}>{bookInfo.author}</Text>
                </TouchableOpacity>

                {/* Book Meta Info */}
                <View style={styles.bookMeta}>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{bookInfo.year}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <BookIcon size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{bookInfo.pages} p.</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Star size={14} color="#20B8CD" fill="#20B8CD" />
                    <Text style={styles.metaText}>{bookInfo.rating}/5</Text>
                  </View>
                </View>

                {/* Genre Badge */}
                <View style={styles.genreBadge}>
                  <Text style={styles.genreText}>{bookInfo.genre}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.bookDesc}>{bookInfo.description}</Text>
          </View>

          {/* About Author */}
          {authorDescriptions[bookInfo.author] && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <User size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AuthorDetail', { authorName: bookInfo.author })}>
                <Text style={styles.authorNameClickable}>{bookInfo.author}</Text>
              </TouchableOpacity>
              <Text style={styles.authorDesc}>{authorDescriptions[bookInfo.author]}</Text>
            </View>
          )}

          {/* Similar Books */}
          {uniqueSimilarBooks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <BookOpen size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>Livres similaires</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarBooksContainer}>
                {uniqueSimilarBooks.map((sBookTitle) => {
                  const similarBookInfo = bookDescriptions[sBookTitle];
                  if (!similarBookInfo) return null;
                  return (
                    <TouchableOpacity 
                      key={sBookTitle} 
                      style={styles.similarBookItem} 
                      onPress={() => navigation.push('BookDetail', { bookTitle: sBookTitle })}
                    >
                      <Image source={{ uri: similarBookInfo.cover }} style={styles.similarBookCover} />
                      <Text numberOfLines={2} style={styles.similarBookTitle}>{sBookTitle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
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
  section: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bookContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  bookCoverImage: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bookAuthorText: {
    fontSize: 14,
    color: '#20B8CD',
    marginBottom: 12,
  },
  bookMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  genreBadge: {
    backgroundColor: 'rgba(32, 184, 205, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  genreText: {
    fontSize: 11,
    color: '#20B8CD',
    fontWeight: '500',
  },
  bookDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9CA3AF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  authorNameClickable: {
    fontSize: 14,
    fontWeight: '500',
    color: '#20B8CD',
    marginBottom: 8, // Maintenir le style cliquable
  },
  authorDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9CA3AF',
  },
  similarBooksContainer: {
    marginHorizontal: -8,
  },
  similarBookItem: {
    width: 90,
    marginHorizontal: 8,
  },
  similarBookCover: {
    width: 90,
    height: 135,
    borderRadius: 8,
    marginBottom: 8,
  },
  similarBookTitle: {
    fontSize: 12,
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 16,
  },
  errorText: { color: 'white', textAlign: 'center', marginTop: 50 },
});