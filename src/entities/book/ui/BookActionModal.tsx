import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { AppText } from '@/src/shared/ui';
import { Tag, Trash2, X } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { useSinglePress } from '@/src/shared/lib/pressUtils';

interface BookActionModalProps {
  visible: boolean;
  onClose: () => void;
  onChangeStatus: () => void;
  onDelete: () => void;
}

const BookActionModal = React.memo(({ visible, onClose, onChangeStatus, onDelete }: BookActionModalProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleChangeStatusPress = useSinglePress(() => {
    onChangeStatus();
    onClose();
  }, 500, [onChangeStatus, onClose]);

  const handleDeletePress = useSinglePress(() => {
    onDelete();
    onClose();
  }, 500, [onDelete, onClose]);

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
            <AppText style={styles.actionMenuTitle}>Options du livre</AppText>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={handleChangeStatusPress}
          >
            <Tag size={20} color={colors.text} style={{ marginRight: 12 }} />
            <AppText style={styles.actionMenuText}>Modifier le statut</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionMenuItem, { borderBottomWidth: 0 }]}
            onPress={handleDeletePress}
          >
            <Trash2 size={20} color={colors.error} style={{ marginRight: 12 }} />
            <AppText style={[styles.actionMenuText, { color: colors.error }]}>Supprimer</AppText>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
});

BookActionModal.displayName = 'BookActionModal';

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

export default BookActionModal;
