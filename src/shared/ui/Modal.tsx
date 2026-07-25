import React from 'react';
import {
  Modal as RNModal,
  ModalProps as RNModalProps,
  View,
  ViewStyle,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';

export interface ModalProps extends RNModalProps {
  children: React.ReactNode;
  onClose?: () => void;
  avoidKeyboard?: boolean;
  scrollable?: boolean;
  containerStyle?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
}

export const Modal: React.FC<ModalProps> = React.memo(({
  visible = false,
  onRequestClose,
  onClose,
  avoidKeyboard = true,
  scrollable = false,
  animationType = 'slide',
  transparent = true,
  containerStyle,
  contentStyle,
  children,
  ...rest
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
    if (onRequestClose) {
      onRequestClose({} as any);
    }
  }, [onClose, onRequestClose]);

  const modalContent = (
    <View
      style={[
        styles.modalOverlay,
        { backgroundColor: colors.backdrop || 'rgba(0, 0, 0, 0.5)' },
        containerStyle,
      ]}
      onStartShouldSetResponder={() => true}
    >
      <View
        style={[
          styles.modalContent,
          {
            backgroundColor: colors.surface,
            borderColor: colors.surfaceHighlight,
            shadowColor: colors.text,
          },
          contentStyle,
        ]}
      >
        {scrollable ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </View>
    </View>
  );

  if (avoidKeyboard) {
    return (
      <RNModal
        visible={visible}
        onRequestClose={handleClose}
        animationType={animationType}
        transparent={transparent}
        {...rest}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoiding}
        >
          {modalContent}
        </KeyboardAvoidingView>
      </RNModal>
    );
  }

  return (
    <RNModal
      visible={visible}
      onRequestClose={handleClose}
      animationType={animationType}
      transparent={transparent}
      {...rest}
    >
      {modalContent}
    </RNModal>
  );
});

Modal.displayName = 'Modal';

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '90%',
  },
  scrollContent: {
    flexGrow: 1,
  },
});
