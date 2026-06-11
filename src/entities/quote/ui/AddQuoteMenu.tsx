import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { Camera, Edit3 } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface AddQuoteMenuProps {
  visible: boolean;
  onClose: () => void;
  onScanPress: () => void;
  onManualAddPress: () => void;
}

const AddQuoteMenu = React.memo(({ visible, onClose, onScanPress, onManualAddPress }: AddQuoteMenuProps) => {
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
          {/* Scan Option */}
          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={() => {
              onScanPress();
              onClose();
            }}
            accessible={true}
            accessibilityLabel="Scanner une citation"
            accessibilityRole="button"
            testID="scan-quote-option"
          >
            <Camera size={20} color={colors.text} style={{ marginRight: 12 }} />
            <Text style={styles.actionMenuText}>Scanner une citation</Text>
          </TouchableOpacity>

          {/* Manual Add Option */}
          <TouchableOpacity
            style={[styles.actionMenuItem, { borderBottomWidth: 0 }]}
            onPress={() => {
              onManualAddPress();
              onClose();
            }}
            accessible={true}
            accessibilityLabel="Ajouter manuellement une citation"
            accessibilityRole="button"
            testID="manual-entry-button"
          >
            <Edit3 size={20} color={colors.text} style={{ marginRight: 12 }} />
            <Text style={styles.actionMenuText}>Ajouter une citation</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
});

AddQuoteMenu.displayName = 'AddQuoteMenu';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
  },
  actionMenuContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
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

export default AddQuoteMenu;
