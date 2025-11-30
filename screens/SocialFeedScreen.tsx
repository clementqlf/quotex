import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

const socialQuotes = [
  {
    id: 1,
    user: {
      name: "Sophie Martin",
      username: "@sophiereads",
    },
    text: "The only impossible journey is the one you never begin.",
    book: "The Alchemist",
    author: "Paulo Coelho",
    time: "Il y a 5min",
    likes: 142,
    comments: 12,
    isLiked: false,
    isSaved: false,
  },
  {
    id: 2,
    user: {
      name: "Lucas Bernard",
      username: "@lucas_books",
    },
    text: "It is never too late to be what you might have been.",
    book: "Middlemarch",
    author: "George Eliot",
    time: "Il y a 15min",
    likes: 89,
    comments: 5,
    isLiked: true,
    isSaved: false,
  },
];

export default function SocialFeedScreen() {
  const [quotes, setQuotes] = useState(socialQuotes);

  const toggleLike = (id: number) => {
    setQuotes(quotes.map(q =>
      q.id === id
        ? { ...q, isLiked: !q.isLiked, likes: q.isLiked ? q.likes - 1 : q.likes + 1 }
        : q
    ));
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Icon name="trending-up" size={24} color="#20B8CD" />
            <Text style={styles.headerTitle}>Feed</Text>
          </View>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="zap" size={20} color="#9CA3AF" />
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
        {quotes.map((quote) => (
          <View key={quote.id} style={styles.quoteCard}>
            {/* User Info */}
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(quote.user.name)}</Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{quote.user.name}</Text>
                <Text style={styles.userMeta}>
                  {quote.user.username} · {quote.time}
                </Text>
              </View>
            </View>

            {/* Quote */}
            <View style={styles.quoteContent}>
              <Text style={styles.quoteIcon}>"</Text>
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
                  <Icon
                    name="heart"
                    size={20}
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
                  <Icon name="message-circle" size={20} color="#6B7280" />
                  <Text style={styles.actionText}>{quote.comments}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <Icon name="share-2" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => toggleSave(quote.id)}>
                <Icon
                  name="bookmark"
                  size={20}
                  color={quote.isSaved ? '#20B8CD' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Floating Refresh Button */}
      <TouchableOpacity style={styles.fab}>
        <Icon name="trending-up" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
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