import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { X, Calendar, User, Sparkles, BookOpen, Heart, Share2, Star } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import {
  aiInterpretations,
  authorDescriptions,
  bookDescriptions,
  similarBooks,
  similarAuthors,
} from '../data/staticData';
import { RootStackParamList, AnyQuote } from '../types';

interface QuoteDetailModalProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote: AnyQuote;
  onClose: () => void;
  onToggleLike: (id: number) => void;
}

// --- Composant ---

export function QuoteDetailModal({
  quote,
  onClose,
  onToggleLike,
}: QuoteDetailModalProps) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // --- Handlers de navigation ---
  const handleNavigate = (screen: keyof RootStackParamList, params: any) => {
    onClose(); // Ferme la modale avant de naviguer
    navigation.navigate(screen, params);
  };

  // --- Données dérivées ---
  const aiInterpretation =
    aiInterpretations[quote.text] ||
    "Cette citation nous invite à réfléchir sur notre condition humaine et nos aspirations.";
  const authorDesc =
    authorDescriptions[quote.author] || `${quote.author} est un auteur reconnu.`;
  const similarBookList = similarBooks[quote.text] || [];
  const similarAuthorList = similarAuthors[quote.author] || [];
  const bookInfo = bookDescriptions[quote.book];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Détails de la citation</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Section Citation */}
        <View style={styles.section}>
          <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
            <Path
              d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
              fill="#20B8CD"
              opacity={0.2}
            />
          </Svg>
          <Text style={styles.quoteText}>{quote.text}</Text>

          <View style={styles.metadata}>
            <TouchableOpacity 
              style={styles.metaRow} 
              onPress={() => handleNavigate('BookDetail', { bookTitle: quote.book })}
            >
              <BookOpen size={16} color="#6B7280" />
              <Text style={styles.metaTextBook}>{quote.book}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.metaRow} 
              onPress={() => handleNavigate('AuthorDetail', { authorName: quote.author })}
            >
              <User size={16} color="#6B7280" />
              <Text style={styles.metaTextAuthor}>{quote.author}</Text>
            </TouchableOpacity>
            {quote.date && (
              <View style={styles.metaRow}>
                <Calendar size={16} color="#6B7280" />
                <Text style={styles.metaTextDate}>{quote.date}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, !onToggleLike && { display: 'none' }]}
            onPress={() => onToggleLike(quote.id)}
          >
            <Heart
              size={20}
              color={quote.isLiked ? '#20B8CD' : '#6B7280'}
              fill={quote.isLiked ? '#20B8CD' : 'none'}
            />
            <Text style={[styles.actionText, quote.isLiked && styles.actionTextActive]}>
              {quote.likes}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Share2 size={20} color="#6B7280" />
            <Text style={styles.actionText}>Partager</Text>
          </TouchableOpacity>
        </View>

        {/* Interprétation IA */}
        <View style={styles.aiSection}>
          <View style={styles.aiHeader}>
            <Sparkles size={16} color="#20B8CD" />
            <Text style={styles.aiTitle}>Interprétation IA</Text>
          </View>
          <Text style={styles.aiText}>{aiInterpretation}</Text>
        </View>

        {/* Informations sur le livre */}
        {bookInfo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>À propos du livre</Text>
            </View>
            <TouchableOpacity onPress={() => handleNavigate('BookDetail', { bookTitle: quote.book })}>
              <View style={styles.bookContainer}>
                <Image source={{ uri: bookInfo.cover }} style={styles.bookCover} />
                <View style={styles.bookInfo}>
                  <Text style={styles.bookName}>{quote.book}</Text>
                  <Text style={styles.bookAuthor}>{quote.author}</Text>
                  <View style={styles.bookMeta}>
                    <View style={styles.metaItem}><Calendar size={14} color="#6B7280" /><Text style={styles.metaText}>{bookInfo.year}</Text></View>
                    <View style={styles.metaItem}><BookOpen size={14} color="#6B7280" /><Text style={styles.metaText}>{bookInfo.pages} p.</Text></View>
                    <View style={styles.metaItem}><Star size={14} color="#20B8CD" fill="#20B8CD" /><Text style={styles.metaText}>{bookInfo.rating}/5</Text></View>
                  </View>
                  <View style={styles.genreBadge}><Text style={styles.genreText}>{bookInfo.genre}</Text></View>
                </View>
              </View>
              <Text style={styles.bookDesc}>{bookInfo.description}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* À propos de l'auteur */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={16} color="#20B8CD" />
            <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
          </View>
          <TouchableOpacity onPress={() => handleNavigate('AuthorDetail', { authorName: quote.author })}>
            <Text style={styles.authorName}>{quote.author}</Text>
          </TouchableOpacity>
          <Text style={styles.authorDesc}>{authorDesc}</Text>
        </View>

        {/* Livres similaires */}
        {similarBookList.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>Livres similaires</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarBooksContainer}>
              {similarBookList.map((bookTitle) => {
                const similarBookInfo = bookDescriptions[bookTitle];
                if (!similarBookInfo) return null;
                return (
                  <TouchableOpacity key={bookTitle} style={styles.similarBookItem} onPress={() => handleNavigate('BookDetail', { bookTitle })}>
                    <Image source={{ uri: similarBookInfo.cover }} style={styles.similarBookCover} />
                    <Text numberOfLines={2} style={styles.similarBookTitle}>{bookTitle}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Auteurs similaires */}
        {similarAuthorList.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>Auteurs similaires</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.similarBooksContainer}>
              {similarAuthorList.map((authorName) => {
                const authorBook = Object.values(bookDescriptions).find(book => book.author === authorName);
                const authorCover = authorBook?.cover || 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400&h=600&fit=crop';
                return (
                  <TouchableOpacity key={authorName} style={styles.similarBookItem} onPress={() => handleNavigate('AuthorDetail', { authorName })}>
                    <Image source={{ uri: authorCover }} style={styles.similarBookCover} />
                    <Text numberOfLines={2} style={styles.similarBookTitle}>{authorName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  // ... (tous les styles restent les mêmes)
  container: {
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: Dimensions.get('window').height * 0.85,
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginLeft: 36, // Pour centrer le titre
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 36,
    color: '#E5E7EB',
    marginVertical: 12,
    fontFamily: 'Times New Roman',
    fontStyle: 'italic',
  },
  metadata: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaTextBook: {
    color: '#20B8CD',
    fontSize: 13,
  },
  metaTextAuthor: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  metaTextDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
  },
  actionText: {
    fontSize: 13,
    color: '#6B7280',
  },
  actionTextActive: {
    color: '#20B8CD',
  },
  aiSection: {
    backgroundColor: 'rgba(32, 184, 205, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#20B8CD',
  },
  aiText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#E5E7EB',
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
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#20B8CD',
    marginBottom: 8,
  },
  authorDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#9CA3AF',
  },
  bookContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  bookCover: {
    width: 80,
    height: 120,
    borderRadius: 8,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 12,
    color: '#20B8CD',
    marginBottom: 12,
  },
  bookMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
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
    fontSize: 12,
    lineHeight: 18,
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
});
