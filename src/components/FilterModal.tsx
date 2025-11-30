import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
}

export interface FilterOptions {
  sortBy: 'recent' | 'oldest' | 'popular';
  yearRange: { min?: number; max?: number };
  author?: string;
}

export function FilterModal({ visible, onClose, onApply }: FilterModalProps) {
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'popular'>('recent');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const years = [2025, 2024, 2023, 2022, 2021, 2020];

  const handleApply = () => {
    onApply({
      sortBy,
      yearRange: selectedYear ? { min: selectedYear, max: selectedYear } : {},
    });
    onClose();
  };

  const handleReset = () => {
    setSortBy('recent');
    setSelectedYear(null);
  };

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
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>Réinitialiser</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Filtres</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Sort By Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trier par</Text>
              
              <TouchableOpacity
                style={[styles.option, sortBy === 'recent' && styles.optionSelected]}
                onPress={() => setSortBy('recent')}
              >
                <Text style={[styles.optionText, sortBy === 'recent' && styles.optionTextSelected]}>
                  Plus récentes
                </Text>
                {sortBy === 'recent' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, sortBy === 'oldest' && styles.optionSelected]}
                onPress={() => setSortBy('oldest')}
              >
                <Text style={[styles.optionText, sortBy === 'oldest' && styles.optionTextSelected]}>
                  Plus anciennes
                </Text>
                {sortBy === 'oldest' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, sortBy === 'popular' && styles.optionSelected]}
                onPress={() => setSortBy('popular')}
              >
                <Text style={[styles.optionText, sortBy === 'popular' && styles.optionTextSelected]}>
                  Plus populaires
                </Text>
                {sortBy === 'popular' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            </View>

            {/* Year Filter Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Année de scan</Text>
              
              <View style={styles.yearGrid}>
                {years.map(year => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.yearChip,
                      selectedYear === year && styles.yearChipSelected,
                    ]}
                    onPress={() => setSelectedYear(year === selectedYear ? null : year)}
                  >
                    <Text
                      style={[
                        styles.yearChipText,
                        selectedYear === year && styles.yearChipTextSelected,
                      ]}
                    >
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Apply Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Appliquer les filtres</Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: '75%',
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
  resetText: {
    color: '#20B8CD',
    fontSize: 15,
    fontWeight: '600',
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  optionSelected: {
    backgroundColor: 'rgba(32, 184, 205, 0.15)',
    borderColor: '#20B8CD',
  },
  optionText: {
    color: '#E5E7EB',
    fontSize: 15,
  },
  optionTextSelected: {
    color: '#20B8CD',
    fontWeight: '600',
  },
  checkmark: {
    color: '#20B8CD',
    fontSize: 18,
    fontWeight: '700',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  yearChip: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  yearChipSelected: {
    backgroundColor: '#20B8CD',
    borderColor: '#20B8CD',
  },
  yearChipText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  yearChipTextSelected: {
    color: '#FFFFFF',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
  },
  applyButton: {
    backgroundColor: '#20B8CD',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
