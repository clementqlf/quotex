import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { X, Edit3, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

interface QuoteActionModalProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const QuoteActionModal = React.memo(({ visible, onClose, onEdit, onDelete }: QuoteActionModalProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.actionMenuContainer}>
          <View style={styles.actionMenuHeader}>
            <Text style={styles.actionMenuTitle}>Options</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={() => {
              onEdit();
              onClose();
            }}
          >
            <Edit3 size={20} color={colors.text} style={{ marginRight: 12 }} />
            <Text style={styles.actionMenuText}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionMenuItem, { borderBottomWidth: 0 }]}
            onPress={() => {
              onDelete();
              onClose();
            }}
          >
            <Trash2 size={20} color={colors.warning} style={{ marginRight: 12 }} />
            <Text style={[styles.actionMenuText, { color: colors.warning }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
});

QuoteActionModal.displayName = 'QuoteActionModal';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenuContainer: {
    width: '80%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionMenuTitle: {
    fontSize: 18,
    color: colors.text,
    fontWeight: 'bold',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighlight,
  },
  actionMenuText: {
    fontSize: 16,
    color: colors.text,
  },
});

export default QuoteActionModal;
