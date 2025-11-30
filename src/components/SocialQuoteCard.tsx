import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { SocialQuote } from '../types';

interface SocialQuoteCardProps {
  quote: SocialQuote;
  onUserPress?: (userId: string) => void;
  onBookPress?: (bookId: string) => void;
  onAuthorPress?: (authorId: string) => void;
}

export default function SocialQuoteCard({ quote, onUserPress, onBookPress, onAuthorPress }: SocialQuoteCardProps) {
  const [isLiked, setIsLiked] = useState(quote.isLiked);
  const [likesCount, setLikesCount] = useState(quote.likes);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}j`;
  };

  return (
    <View style={styles.card}>
      {/* User Header */}
      <TouchableOpacity 
        style={styles.header}
        onPress={() => onUserPress?.(quote.userId)}
      >
        <Image source={{ uri: quote.userAvatar }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{quote.userName}</Text>
          <Text style={styles.timeAgo}>{formatTimeAgo(quote.postedAt)}</Text>
        </View>
      </TouchableOpacity>

      {/* Quote Content */}
      <View style={styles.content}>
        <Text style={styles.quoteText}>"{quote.text}"</Text>
        
        <View style={styles.metadata}>
          <TouchableOpacity onPress={() => onBookPress?.(quote.bookId)}>
            <Text style={styles.bookTitle}>{quote.bookTitle}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => onAuthorPress?.(quote.authorId)}>
            <Text style={styles.authorName}>— {quote.authorName}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Icon 
            name="heart" 
            size={20} 
            color={isLiked ? '#20B8CD' : '#8A8A8A'}
            fill={isLiked ? '#20B8CD' : 'none'}
          />
          <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Icon name="message-circle" size={20} color="#8A8A8A" />
          <Text style={styles.actionText}>{quote.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Icon name="share-2" size={20} color="#8A8A8A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 2,
  },
  timeAgo: {
    color: '#6A6A6A',
    fontSize: 13,
  },
  content: {
    marginBottom: 16,
  },
  quoteText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  metadata: {
    gap: 4,
  },
  bookTitle: {
    color: '#20B8CD',
    fontSize: 14,
  },
  authorName: {
    color: '#B8B8B8',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: '#8A8A8A',
    fontSize: 14,
  },
  actionTextActive: {
    color: '#20B8CD',
  },
});