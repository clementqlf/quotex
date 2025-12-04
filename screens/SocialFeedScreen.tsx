import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { TrendingUp, Zap, Heart, MessageCircle, Share2, Bookmark } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useTabIndex } from '../TabNavigator';
import { globalQuotesDB, Quote } from '../data/staticData';

export default function SocialFeedScreen() {
  const navigation = useNavigation<any>();
  const [quotes, setQuotes] = useState(globalQuotesDB);
  const { setTabIndex } = useTabIndex();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) setTabIndex(2);
  }, [isFocused]);

  // Rafraîchit les données lorsque l'écran est focus pour voir les nouvelles citations globales
  useEffect(() => {
    if (isFocused) {
      setQuotes([...globalQuotesDB]);
    }
  }, [isFocused]);

  const toggleLike = (id: number) => {
    const newQuotes = quotes.map(q => {
      if (q.id === id) {
        const updatedQuote = { ...q, isLiked: !q.isLiked, likes: q.isLiked ? q.likes - 1 : q.likes + 1 };
        // Mettre à jour la "base de données" pour la persistance de la démo
        const dbIndex = globalQuotesDB.findIndex(dbq => dbq.id === id);
        if (dbIndex > -1) globalQuotesDB[dbIndex] = updatedQuote;
        return updatedQuote;
      }
      return q;
    });
    setQuotes(newQuotes);
  };

  const toggleSave = (id: number) => {
    setQuotes(quotes.map(q =>
      q.id === id ? { ...q, isSaved: !q.isSaved } : q
    ));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TrendingUp size={24} color="#20B8CD" />
            <Text style={styles.headerTitle}>Feed</Text>
          </View>
          <TouchableOpacity style={styles.headerButton}>
            <Zap size={20} color="#9CA3AF" />
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
        {quotes.map((quote) => {
          // On s'assure que l'objet passé à QuoteDetail contient toutes les informations nécessaires,
          // y compris l'objet `user` complet avec son `id`.
          // On mappe aussi `time` vers `date` pour la cohérence.
          const quoteForDetail = { ...quote, date: quote.time, user: quote.user };

          return (
            <TouchableOpacity key={quote.id} style={styles.quoteCard} activeOpacity={0.8} onPress={() => {
              // On trouve la dernière version de la citation pour la passer au modal
              const currentQuote = quotes.find(q => q.id === quote.id) || quote;
              navigation.navigate('QuoteDetail', { quote: { ...currentQuote, date: currentQuote.time }, onToggleLike: () => toggleLike(quote.id) });
            }}>
              {/* User Info - Cliquable */}
              <TouchableOpacity 
                style={styles.userInfo} 
                onPress={(e) => {
                  e.stopPropagation(); // Empêche le clic de se propager à la carte parente
                  navigation.navigate('UserProfile', { user: quote.user });
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(quote.user.name)}</Text>
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{quote.user.name}</Text>
                  <Text style={styles.userMeta}>
                    {quote.user.username} · {quote.time}
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
                  <Text style={styles.bookName}>{quote.book}</Text>
                  <Text style={styles.separator}>·</Text>
                  <Text style={styles.authorName}>{quote.author}</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <View style={styles.actionsLeft}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => toggleLike(quote.id)}
                  >
                    <Heart
                      size={20}
                      fill={quote.isLiked ? '#20B8CD' : 'transparent'}
                      color={quote.isLiked ? '#20B8CD' : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.actionText,
                        quote.isLiked && styles.actionTextActive,
                      ]}
                    >
                      {quote.likes}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <MessageCircle size={20} color="#6B7280" />
                    <Text style={styles.actionText}>{quote.comments}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Share2 size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => toggleSave(quote.id)}>
                  <Bookmark
                    fill={quote.isSaved ? '#20B8CD' : 'transparent'}
                    size={20}
                    color={quote.isSaved ? '#20B8CD' : '#6B7280'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
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
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(32, 184, 205, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    alignItems: 'center',
  },
  tabInactive: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  tabTextActive: {
    fontSize: 14,
    color: '#20B8CD',
  },
  tabTextInactive: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 96,
  },
  quoteCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
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
    backgroundColor: 'rgba(32, 184, 205, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    color: '#20B8CD',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  userMeta: {
    fontSize: 12,
    color: '#6B7280',
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
    color: '#E5E7EB',
    marginBottom: 12,
  },
  bookTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  bookName: {
    fontSize: 12,
    color: '#20B8CD',
  },
  separator: {
    fontSize: 12,
    color: '#4B5563',
  },
  authorName: {
    fontSize: 12,
    color: '#6B7280',
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
    color: '#6B7280',
  },
  actionTextActive: {
    color: '#20B8CD',
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#20B8CD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});