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
import { Author } from '../types';

interface AuthorProfileProps {
  visible: boolean;
  author: Author | null;
  onClose: () => void;
}

export function AuthorProfile({ visible, author, onClose }: AuthorProfileProps) {
  if (!author) return null;

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
            <Text style={styles.headerTitle}>Profil de l'auteur</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Author Photo */}
            <View style={styles.photoContainer}>
              {author.photo ? (
                <Image source={{ uri: author.photo }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoInitial}>
                    {author.name.charAt(0)}
                  </Text>
                </View>
              )}
            </View>

            {/* Author Name */}
            <Text style={styles.name}>{author.name}</Text>

            {/* Specialty */}
            {author.specialty && (
              <View style={styles.specialtyBadge}>
                <Text style={styles.specialtyText}>{author.specialty}</Text>
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsContainer}>
              {author.booksCount !== undefined && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{author.booksCount}</Text>
                  <Text style={styles.statLabel}>Livres publiés</Text>
                </View>
              )}
              {author.followersCount !== undefined && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {author.followersCount >= 1000
                      ? `${(author.followersCount / 1000).toFixed(1)}k`
                      : author.followersCount}
                  </Text>
                  <Text style={styles.statLabel}>Lecteurs</Text>
                </View>
              )}
            </View>

            {/* Biography */}
            {author.bio && (
              <View style={styles.bioSection}>
                <Text style={styles.sectionTitle}>Biographie</Text>
                <View style={styles.bioCard}>
                  <Text style={styles.bioText}>{author.bio}</Text>
                </View>
              </View>
            )}

            {/* Recent Books */}
            <View style={styles.booksSection}>
              <Text style={styles.sectionTitle}>Derniers livres</Text>
              
              <View style={styles.bookCard}>
                <View style={styles.bookCoverSmall}>
                  <Text style={styles.bookEmoji}>📖</Text>
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>Livre récent 1</Text>
                  <Text style={styles.bookYear}>2024</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>

              <View style={styles.bookCard}>
                <View style={styles.bookCoverSmall}>
                  <Text style={styles.bookEmoji}>📚</Text>
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>Livre récent 2</Text>
                  <Text style={styles.bookYear}>2023</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Suivre l'auteur</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>
                  Voir toutes les citations
                </Text>
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
    alignItems: 'center',
  },
  photoContainer: {
    marginBottom: 16,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#20B8CD',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#20B8CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitial: {
    color: '#0F0F0F',
    fontSize: 48,
    fontWeight: '700',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  specialtyBadge: {
    backgroundColor: 'rgba(32, 184, 205, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.3)',
  },
  specialtyText: {
    color: '#20B8CD',
    fontSize: 13,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
    width: '100%',
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
    textAlign: 'center',
  },
  bioSection: {
    width: '100%',
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  bioCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  bioText: {
    color: '#E5E7EB',
    fontSize: 15,
    lineHeight: 24,
  },
  booksSection: {
    width: '100%',
    marginBottom: 32,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  bookCoverSmall: {
    width: 48,
    height: 64,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bookEmoji: {
    fontSize: 24,
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  bookYear: {
    color: '#6B7280',
    fontSize: 13,
  },
  chevron: {
    color: '#6B7280',
    fontSize: 24,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#20B8CD',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
});
