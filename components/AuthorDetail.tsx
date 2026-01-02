import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ChevronLeft, BookOpen, User, Calendar, Globe, Heart } from 'lucide-react-native';
import { useData } from '../src/contexts/DataProvider';
import { getAuthorName, getBookTitle } from '../src/utils/dataHelpers';
import { Author, Book, RootStackParamList } from '../types';

type AuthorDetailScreenRouteProp = RouteProp<RootStackParamList, 'AuthorDetail'>;

export function AuthorDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<AuthorDetailScreenRouteProp>();
  // Handle both cases: author object passed (Search) or maybe just name (Legacy?)
  // types.ts says { author: Author }, so we should rely on that.
  // But let's be safe if we need to fall back.
  const { author, authorName: paramAuthorName } = route.params;
  const nameToUse = author?.name || paramAuthorName;

  const { quotes, getBooksByAuthor, getAuthorByName, toggleLikeQuote } = useData();
  const [authorInfo, setAuthorInfo] = React.useState<Author | null>(author || null);
  const [authorBooks, setAuthorBooks] = React.useState<Book[]>([]);
  const [isLoadingAuthor, setIsLoadingAuthor] = React.useState(true);

  React.useEffect(() => {
    async function loadAuthorData() {
      if (!nameToUse) return;

      setIsLoadingAuthor(true);
      try {
        const [books, fetchedAuthor] = await Promise.all([
          getBooksByAuthor(nameToUse),
          !authorInfo ? getAuthorByName(nameToUse) : Promise.resolve(null)
        ]);

        setAuthorBooks(books);
        if (fetchedAuthor) {
          setAuthorInfo(fetchedAuthor);
        }

      } catch (error) {
        console.error("Error loading author data:", error);
      } finally {
        setIsLoadingAuthor(false);
      }
    }
    loadAuthorData();
  }, [nameToUse, getBooksByAuthor, getAuthorByName]);

  const authorName = authorInfo?.name || nameToUse || 'Inconnu';
  const authorDesc = authorInfo?.description || `${authorName} est un auteur reconnu.`;
  const authorImage = authorInfo?.image || 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=400&h=400&fit=crop';

  // Compte le nombre total de citations pour cet auteur depuis la DB locale (qui contient tout en mode serveur)
  const totalQuotes = quotes.filter(q =>
    typeof q.author === 'string' ? q.author === authorName : q.author?.name === authorName
  ).length;

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
          <Text style={styles.headerTitle} numberOfLines={1}>{authorName}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Author Profile Header */}
          <View style={styles.profileHeader}>
            <Image source={{ uri: authorImage }} style={styles.authorImage} />
            <Text style={styles.authorName}>{authorName}</Text>
          </View>

          {/* About Author Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
            </View>
            <Text style={styles.authorDesc}>{authorDesc}</Text>
          </View>

          {/* Details Section */}
          <View style={styles.section}>
            <View style={styles.detailsContainer}>
              <View style={styles.detailItem}>
                <Calendar size={16} color="#9CA3AF" />
                <Text style={styles.detailLabel}>Naissance</Text>
                <Text style={styles.detailValue}>{authorInfo?.birthDate || 'Inconnu'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Globe size={16} color="#9CA3AF" />
                <Text style={styles.detailLabel}>Nationalité</Text>
                <Text style={styles.detailValue}>{authorInfo?.nationality || 'Inconnue'}</Text>
              </View>
            </View>
          </View>

          {/* Stats Section */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{authorBooks.length}</Text>
              <Text style={styles.statLabel}>Livres</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalQuotes}</Text>
              <Text style={styles.statLabel}>Citations</Text>
            </View>
          </View>

          {/* Books by Author Section */}
          {/* Books by Author Section */}
          {authorBooks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <BookOpen size={16} color="#20B8CD" />
                <Text style={styles.sectionTitle}>Livres de {authorName}</Text>
              </View>
              {authorBooks.map((book) => (
                <TouchableOpacity
                  key={book.title}
                  style={styles.bookItem}
                  onPress={() => navigation.navigate('BookDetail', { bookTitle: book.title })}>
                  <Image source={{ uri: book.cover }} style={styles.bookCover} />
                  <View style={styles.bookInfo}>
                    <Text style={styles.bookTitle}>{book.title}</Text>
                    <Text style={styles.bookMetaText}>{book.year}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* User's Saved Quotes Section */}
          {(() => {
            const userQuotes = quotes.filter(q => {
              // Filter for "My Quotes" logic (user 1 or legacy local)
              const isMyQuote = q.user?.id == 1 || !q.user;
              if (!isMyQuote) return false;

              // Match author
              const qAuthorName = typeof q.author === 'string' ? q.author : q.author?.name;
              return qAuthorName === authorName;
            });

            if (userQuotes.length === 0) return null;

            return (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: '#20B8CD' }]}>Mes Citations</Text>
                </View>
                <View style={{ gap: 12 }}>
                  {userQuotes.map((quote) => (
                    <TouchableOpacity
                      key={quote.id}
                      style={styles.quoteCard}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('QuoteDetail', { quote })}
                    >
                      <Text style={styles.quoteText}>"{quote.text}"</Text>
                      <View style={styles.quoteMeta}>
                        <View style={styles.quoteMetaLeft}>
                          {/* Auhtor is redundant here, so we only show book title */}
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
                            <Text style={styles.likeCount}>{quote.likesCount}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1, textAlign: 'center'
  },
  placeholder: {
    width: 28, // to balance the back button
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  authorImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#20B8CD',
    marginBottom: 12,
  },
  authorName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    color: '#20B8CD',
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
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
  authorDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: '#9CA3AF',
  },
  detailsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#E5E7EB',
    fontWeight: '600',
    textAlign: 'center',
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  bookCover: {
    width: 50,
    height: 75,
    borderRadius: 6,
    marginRight: 16,
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E5E7EB',
    marginBottom: 4,
  },
  bookMetaText: {
    fontSize: 12,
    color: '#6B7280',
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
});