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
import { ChevronLeft, BookOpen } from 'lucide-react-native';
import { authorDescriptions, bookDescriptions } from '../data/staticData';

type AuthorDetailScreenRouteProp = RouteProp<{ params: { authorName: string } }, 'params'>;

export function AuthorDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<AuthorDetailScreenRouteProp>();
  const { authorName } = route.params;

  const authorDesc = authorDescriptions[authorName] || `${authorName} est un auteur reconnu.`;
  const authorBooks = Object.entries(bookDescriptions).filter(
    ([, book]) => book.author === authorName
  );

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
          <Text style={styles.headerTitle}>{authorName}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* About Author Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
            <Text style={styles.authorDesc}>{authorDesc}</Text>
          </View>

          {/* Books by Author Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Livres de {authorName}</Text>
            {authorBooks.map(([bookTitle, bookInfo]) => (
              <TouchableOpacity key={bookTitle} style={styles.bookItem}>
                <Image source={{ uri: bookInfo.cover }} style={styles.bookCover} />
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>{bookTitle}</Text>
                  <Text style={styles.bookMetaText}>{bookInfo.year}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  authorDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: '#9CA3AF',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 12,
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
});