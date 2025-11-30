import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { Quote } from '../types';

interface QuoteCardProps {
  quote: Quote;
  onBookPress?: (bookId: string) => void;
  onAuthorPress?: (authorId: string) => void;
}

export default function QuoteCard({ quote, onBookPress, onAuthorPress }: QuoteCardProps) {
  return (
    <View style={styles.card}>
      {quote.imageUrl && (
        <Image source={{ uri: quote.imageUrl }} style={styles.image} />
      )}
      
      <View style={styles.content}>
        <Text style={styles.quoteText}>"{quote.text}"</Text>
        
        <View style={styles.metadata}>
          <TouchableOpacity onPress={() => onBookPress?.(quote.bookId)}>
            <Text style={styles.bookTitle}>{quote.bookTitle}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => onAuthorPress?.(quote.authorId)}>
            <Text style={styles.authorName}>— {quote.authorName}</Text>
          </TouchableOpacity>
          
          {quote.pageNumber && (
            <Text style={styles.pageNumber}>Page {quote.pageNumber}</Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="share-2" size={20} color="#8A8A8A" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="bookmark" size={20} color="#20B8CD" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  content: {
    padding: 20,
  },
  quoteText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  metadata: {
    marginBottom: 16,
  },
  bookTitle: {
    color: '#20B8CD',
    fontSize: 16,
    marginBottom: 4,
  },
  authorName: {
    color: '#B8B8B8',
    fontSize: 14,
    marginBottom: 8,
  },
  pageNumber: {
    color: '#6A6A6A',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 8,
  },
});