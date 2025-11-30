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
import { Book } from '../types';

interface BookDetailProps {
  visible: boolean;
  book: Book | null;
  onClose: () => void;
  onAuthorPress?: () => void;
}

export function BookDetail({
  visible,
  book,
  onClose,
  onAuthorPress,
}: BookDetailProps) {
  if (!book) return null;

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
            <Text style={styles.headerTitle}>Détails du livre</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Book Cover */}
            <View style={styles.coverContainer}>
              {book.cover ? (
                <Image source={{ uri: book.cover }} style={styles.cover} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Text style={styles.coverPlaceholderText}>📚</Text>
                </View>
              )}
            </View>

            {/* Book Info */}
            <View style={styles.infoSection}>
              <Text style={styles.title}>{book.title}</Text>
              <TouchableOpacity onPress={onAuthorPress}>
                <Text style={styles.author}>{book.author}</Text>
              </TouchableOpacity>
            </View>

            {/* Metadata */}
            <View style={styles.metadataGrid}>
              {book.year && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Année</Text>
                  <Text style={styles.metaValue}>{book.year}</Text>
                </View>
              )}
              {book.pages && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Pages</Text>
                  <Text style={styles.metaValue}>{book.pages}</Text>
                </View>
              )}
              {book.rating && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Note</Text>
                  <Text style={styles.metaValue}>★ {book.rating}/5</Text>
                </View>
              )}
              {book.genre && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Genre</Text>
                  <Text style={styles.metaValue}>{book.genre}</Text>
                </View>
              )}
            </View>

            {/* Theme Badge */}
            {book.theme && (
              <View style={styles.themeBadge}>
                <Text style={styles.themeBadgeText}>{book.theme}</Text>
              </View>
            )}

            {/* Description */}
            {book.description && (
              <View style={styles.descriptionSection}>
                <Text style={styles.sectionTitle}>Synopsis</Text>
                <Text style={styles.description}>{book.description}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  Voir toutes les citations
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Partager</Text>
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
  coverContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cover: {
    width: 160,
    height: 240,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  coverPlaceholder: {
    width: 160,
    height: 240,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  coverPlaceholderText: {
    fontSize: 48,
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  author: {
    color: '#20B8CD',
    fontSize: 16,
    fontWeight: '600',
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metaItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  metaLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  metaValue: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
  themeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(32, 184, 205, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.3)',
  },
  themeBadgeText: {
    color: '#20B8CD',
    fontSize: 13,
    fontWeight: '600',
  },
  descriptionSection: {
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
  description: {
    color: '#E5E7EB',
    fontSize: 15,
    lineHeight: 24,
  },
  actions: {
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
