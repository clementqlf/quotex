import { useTheme } from '@/src/app/providers/ThemeContext';
import { AppText } from '@/src/shared/ui';
import { STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { ThemeColors } from '@/src/shared/theme';
import { useSinglePress } from '@/src/shared/lib/pressUtils';
import { ChevronDown } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

export type FilterType = { type: 'author' | 'book' | 'year' | 'status'; value: string | number };

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  authors: string[];
  books: string[];
  years: number[];
  tempFilters: FilterType[];
  onToggleTempFilter: (type: 'author' | 'book' | 'year' | 'status', value: string | number) => void;
  onApplyFilters: () => void;
  onResetTempFilters: () => void;
}

const FilterModal = React.memo(({
  visible,
  onClose,
  authors,
  books,
  years,
  tempFilters,
  onToggleTempFilter,
  onApplyFilters,
  onResetTempFilters,
}: FilterModalProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedSection, setExpandedSection] = useState<'author' | 'book' | 'year' | 'status' | null>(null);

  const toggleSection = useCallback((section: 'author' | 'book' | 'year' | 'status' | null) => {
    setExpandedSection(current => (current === section ? null : section));
  }, []);

  const handleClose = useCallback(() => {
    setExpandedSection(null);
    onClose();
  }, [onClose]);

  const handleApplyPress = useSinglePress(() => {
    onApplyFilters();
    setExpandedSection(null);
  }, 500, [onApplyFilters]);

  const handleResetPress = useSinglePress(onResetTempFilters, 500, [onResetTempFilters]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <Pressable style={styles.modalView} onPress={(e) => e.stopPropagation()}>
          <AppText style={styles.modalTitle}>Filtrer par</AppText>
          <ScrollView style={{ maxHeight: '80%' }}>
            {/* Section Auteur */}
            <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('author')}>
              <AppText style={styles.filterSectionTitle}>Auteur</AppText>
              <View style={{ transform: [{ rotate: expandedSection === 'author' ? '180deg' : '0deg' }] }}>
                <ChevronDown size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
            {expandedSection === 'author' && authors.map(author => (
              <TouchableOpacity key={author} style={styles.filterOption} onPress={() => onToggleTempFilter('author', author)}>
                <AppText style={[
                  styles.filterOptionText,
                  tempFilters.some(f => f.type === 'author' && f.value === author) && styles.filterOptionTextSelected
                ]}>{author}</AppText>
              </TouchableOpacity>
            ))}

            {/* Section Livre */}
            <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('book')}>
              <AppText style={styles.filterSectionTitle}>Livre</AppText>
              <View style={{ transform: [{ rotate: expandedSection === 'book' ? '180deg' : '0deg' }] }}>
                <ChevronDown size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
            {expandedSection === 'book' && books.map(book => (
              <TouchableOpacity key={book} style={styles.filterOption} onPress={() => onToggleTempFilter('book', book)}>
                <AppText style={[
                  styles.filterOptionText,
                  tempFilters.some(f => f.type === 'book' && f.value === book) && styles.filterOptionTextSelected
                ]}>{book}</AppText>
              </TouchableOpacity>
            ))}

            {/* Section Statut */}
            <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('status')}>
              <AppText style={styles.filterSectionTitle}>Statut</AppText>
              <View style={{ transform: [{ rotate: expandedSection === 'status' ? '180deg' : '0deg' }] }}>
                <ChevronDown size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
            {expandedSection === 'status' && STATUS_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.value} style={styles.filterOption} onPress={() => onToggleTempFilter('status', opt.value)}>
                <AppText style={[
                  styles.filterOptionText,
                  tempFilters.some(f => f.type === 'status' && f.value === opt.value) && styles.filterOptionTextSelected
                ]}>{opt.label}</AppText>
              </TouchableOpacity>
            ))}

            {/* Section Année */}
            <TouchableOpacity style={styles.filterSectionHeader} onPress={() => toggleSection('year')}>
              <AppText style={styles.filterSectionTitle}>Année</AppText>
              <View style={{ transform: [{ rotate: expandedSection === 'year' ? '180deg' : '0deg' }] }}>
                <ChevronDown size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
            {expandedSection === 'year' && years.map(year => (
              <TouchableOpacity key={year} style={styles.filterOption} onPress={() => onToggleTempFilter('year', year)}>
                <AppText style={[
                  styles.filterOptionText,
                  tempFilters.some(f => f.type === 'year' && f.value === year) && styles.filterOptionTextSelected
                ]}>{year}</AppText>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.modalActions}>
            {tempFilters.length > 0 && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetPress}
              >
                <AppText style={styles.resetButtonText}>Réinitialiser</AppText>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.applyButton} onPress={handleApplyPress}>
              <AppText style={styles.applyButtonText}>Appliquer</AppText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

FilterModal.displayName = 'FilterModal';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: colors.text,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighlight,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  filterOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  filterOptionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  filterOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  resetButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
  },
  resetButtonText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  applyButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  applyButtonText: {
    color: colors.buttonText,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default FilterModal;
