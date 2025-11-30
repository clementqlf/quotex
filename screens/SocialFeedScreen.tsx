import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SocialQuoteCard from '../components/SocialQuoteCard';
import { mockSocialQuotes } from '../data/mockData';

export default function SocialFeedScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16 }]}>
        <Text style={styles.headerTitle}>Découvrir</Text>
        <Text style={styles.headerSubtitle}>Citations populaires</Text>
      </View>

      {/* Feed */}
      <ScrollView 
        style={styles.feed}
        contentContainerStyle={[
          styles.feedContent,
          { paddingBottom: insets.bottom + 20 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {mockSocialQuotes.map((quote) => (
          <SocialQuoteCard
            key={quote.id}
            quote={quote}
            onUserPress={(userId) => console.log('User:', userId)}
            onBookPress={(bookId) => console.log('Book:', bookId)}
            onAuthorPress={(authorId) => console.log('Author:', authorId)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#6A6A6A',
    fontSize: 14,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    padding: 20,
  },
});