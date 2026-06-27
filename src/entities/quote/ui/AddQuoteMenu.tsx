import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { Camera, Edit3 } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Dimensions,
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
  triggerY?: number;
}

const AddQuoteMenu = React.memo(({ visible, onClose, onScanPress, onManualAddPress, triggerY }: AddQuoteMenuProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const menuStyle = useMemo(() => {
    if (triggerY === undefined) {
      return styles.actionMenuContainer;
    }
    const screenHeight = Dimensions.get('window').height;
    const menuHeight = 120; // approximate height of the menu
    let top = triggerY + 10;
    if (top + menuHeight > screenHeight - 20) {
      top = triggerY - menuHeight - 10;
    }
    if (top < 20) {
      top = 20;
    }
    return [styles.actionMenuContainer, { top }];
  }, [triggerY, styles.actionMenuContainer]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={menuStyle}>
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
