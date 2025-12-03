import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BookOpen, Search, Filter, Heart, Share2 } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { QuoteDetailModal } from '../components/QuoteDetailModal';

const myQuotes = [
  {
    id: 1,
    text: "The only way to do great work is to love what you do.",
    book: "Steve Jobs",
    author: "Walter Isaacson",
    date: "Il y a 2h",
    likes: 12,
    isLiked: true,
  },
  {
    id: 2,
    text: "In the middle of difficulty lies opportunity.",
    book: "Einstein: His Life and Universe",
    author: "Walter Isaacson",
    date: "Il y a 5h",
    likes: 8,
    isLiked: false,
  },
  {
    id: 3,
    text: "It is our choices that show what we truly are, far more than our abilities.",
    book: "Harry Potter and the Chamber of Secrets",
    author: "J.K. Rowling",
    date: "Hier",
    likes: 24,
    isLiked: true,
  },
];

export default function MyQuotesScreen() {
  const navigation = useNavigation<any>();
  const [quotes, setQuotes] = useState(myQuotes);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  const toggleLike = (id: number) => {
    setQuotes(quotes.map(q =>
      q.id === id
        ? { ...q, isLiked: !q.isLiked, likes: q.isLiked ? q.likes - 1 : q.likes + 1 }
        : q
    ));
    // Update selected quote if it's open
    if (selectedQuote?.id === id) {
      setSelectedQuote((q: any) => ({ ...q, isLiked: !q.isLiked, likes: q.isLiked ? q.likes - 1 : q.likes + 1 }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <BookOpen size={16} color="#20B8CD" />
          </View>
          <Text style={styles.headerTitle}>Mes Citations</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Search size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Filter size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{quotes.length}</Text>
          <Text style={styles.statLabel}>Citations</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{quotes.reduce((acc, q) => acc + q.likes, 0)}</Text>
          <Text style={styles.statLabel}>J'aime</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>8</Text>
          <Text style={styles.statLabel}>Livres</Text>
        </View>
      </View>

      {/* Quotes Feed */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {quotes.map((quote) => (
          <TouchableOpacity
            key={quote.id}
            style={styles.quoteCard}
            onPress={() => setSelectedQuote(quote)}
            activeOpacity={0.7}
          >
            {/* Quote Icon (custom SVG) */}
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" style={styles.quoteIcon}>
              <Path
                d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                fill="#20B8CD"
                opacity={0.12}
              />
            </Svg>

            {/* Quote Text */}
            <Text style={styles.quoteText}>{quote.text}</Text>

            {/* Book Info */}
            <View style={styles.bookInfo}>
              <View style={styles.bookInfoLeft}>
                <Text style={styles.bookTitle}>{quote.book}</Text>
                {/* Le nom de l'auteur n'est plus cliquable ici */}
                <Text style={styles.authorName} onPress={(e) => e.stopPropagation()}>
                  {quote.author}
                </Text>
              </View>
              <Text style={styles.dateText}>{quote.date}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => toggleLike(quote.id)}
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
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Quote Detail Modal */}
      <QuoteDetailModal
        visible={!!selectedQuote}
        quote={selectedQuote}
        onClose={() => setSelectedQuote(null)}
        onToggleLike={toggleLike}
        onAuthorPress={(authorName:string) => {
          setSelectedQuote(null); // Ferme la modale
          navigation.getParent()?.navigate('AuthorDetail', { authorName });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(32, 184, 205, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    color: '#20B8CD',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  quoteCard: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  quoteIcon: {
    fontSize: 32,
    color: 'rgba(32, 184, 205, 0.2)',
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#E5E7EB',
    marginBottom: 16,
  },
  bookInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  bookInfoLeft: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 14,
    color: '#20B8CD',
    marginBottom: 4,
  },
  authorName: {
    fontSize: 12,
    color: '#6B7280',
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionTextActive: {
    color: '#20B8CD',
  },
  iconFilled: {
    // Pour simuler le fill, vous devrez utiliser une icône différente
  },
});