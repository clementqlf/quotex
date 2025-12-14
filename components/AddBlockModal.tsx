import React from 'react';
import { Modal, TouchableOpacity, View, Text, StyleSheet } from 'react-native';

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
  const opts: BlockOption[] = options ?? [
    { key: 'definition', label: 'Définition' },
    { key: 'bookInfo', label: "À propos du livre" },
    { key: 'author', label: "À propos de l'auteur" },
    { key: 'similarBooks', label: 'Livres similaires' },
    { key: 'similarAuthors', label: 'Auteurs similaires' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.addBlockModal}>
          <Text style={styles.addBlockTitle}>Ajouter un bloc</Text>
          {opts.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={styles.addBlockOption}
              onPress={() => onSelect(opt.key)}
            >
              <Text style={styles.addBlockOptionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBlockModal: {
    width: '80%',
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  addBlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  addBlockOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F1F1F',
    marginBottom: 8,
    backgroundColor: '#1A1A1A',
  },
  addBlockOptionText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
});
