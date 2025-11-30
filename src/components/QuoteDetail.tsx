import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { Quote } from '../types';

interface QuoteDetailProps {
  visible: boolean;
  quote: Quote | null;
  onClose: () => void;
  onBookPress?: () => void;
  onAuthorPress?: () => void;
}

export function QuoteDetail({
  visible,
  quote,
  onClose,
  onBookPress,
  onAuthorPress,
}: QuoteDetailProps) {
  if (!quote) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Citation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Quote Text */}
            <View style={styles.quoteContainer}>
              <Text style={styles.quoteText}>"{quote.text}"</Text>
            </View>

            {/* Book Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Livre</Text>
              <TouchableOpacity
                style={styles.infoCard}
                onPress={onBookPress}
                activeOpacity={0.7}
              >
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>{quote.book}</Text>
                  {quote.publicationYear && (
                    <Text style={styles.bookMeta}>
                      Publié en {quote.publicationYear}
                    </Text>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Author Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>À propos de l'auteur</Text>
              <TouchableOpacity
                style={styles.infoCard}
                onPress={onAuthorPress}
                activeOpacity={0.7}
              >
                <View style={styles.authorInfo}>
                  <View style={styles.authorAvatar}>
                    <Text style={styles.authorInitial}>
                      {quote.author.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.authorDetails}>
                    <Text style={styles.authorName}>{quote.author}</Text>
                    <Text style={styles.authorMeta}>Voir le profil complet</Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{quote.likes}</Text>
                <Text style={styles.statLabel}>J'aime</Text>
              </View>
              {quote.scanYear && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{quote.scanYear}</Text>
                  <Text style={styles.statLabel}>Année de scan</Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionButton, styles.likeButton]}>
                <Text style={styles.actionIcon}>
                  {quote.isLiked ? '♥' : '♡'}
                </Text>
                <Text style={styles.actionText}>
                  {quote.isLiked ? 'Aimé' : 'Aimer'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.shareButton]}>
                <Text style={styles.actionIcon}>↗</Text>
                <Text style={styles.actionText}>Partager</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#9CA3AF',
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  quoteContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  quoteText: {
    color: '#E5E7EB',
    fontSize: 18,
    lineHeight: 28,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    color: '#20B8CD',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bookMeta: {
    color: '#6B7280',
    fontSize: 13,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#20B8CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInitial: {
    color: '#0F0F0F',
    fontSize: 20,
    fontWeight: '700',
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  authorMeta: {
    color: '#6B7280',
    fontSize: 13,
  },
  chevron: {
    color: '#6B7280',
    fontSize: 28,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statValue: {
    color: '#20B8CD',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  likeButton: {
    backgroundColor: '#20B8CD',
  },
  shareButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  actionIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});