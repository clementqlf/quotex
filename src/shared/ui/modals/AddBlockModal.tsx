import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface BlockOption {
  key: string;
  label: string;
}

interface AddBlockModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  options?: BlockOption[];
}

export default function AddBlockModal({ visible, onClose, onSelect, options }: AddBlockModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const opts: BlockOption[] = options ?? [
    { key: 'definition', label: 'Définition' },
    { key: 'bookInfo', label: "À propos du livre" },
    { key: 'author', label: "À propos de l'auteur" },
    { key: 'similarBooks', label: 'Livres similaires' },
    { key: 'similarAuthors', label: 'Auteurs similaires' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
        accessible={true}
        accessibilityLabel="Fermer le modal"
        accessibilityRole="button"
      >
        <View style={styles.addBlockModal}>
          <Text style={styles.addBlockTitle}>Ajouter un bloc</Text>
          {opts.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={styles.addBlockOption}
              onPress={() => onSelect(opt.key)}
              accessible={true}
              accessibilityLabel={`Ajouter le bloc ${opt.label}`}
              accessibilityRole="button"
              testID={`add-block-option-${opt.key}`}
            >
              <Text style={styles.addBlockOptionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBlockModal: {
    width: '80%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  addBlockOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  addBlockOptionText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
