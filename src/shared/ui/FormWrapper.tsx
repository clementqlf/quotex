import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';

export interface FormWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardOffset?: number;
  scrollEnabled?: boolean;
  testID?: string;
}

/**
 * Reusable FSD shared component for form screens and modals.
 * Provides keyboard avoiding, tap-outside-to-dismiss, and handles
 * button taps without swallowing the first touch when the keyboard is open.
 */
export const FormWrapper: React.FC<FormWrapperProps> = ({
  children,
  style,
  contentContainerStyle,
  keyboardOffset = 0,
  scrollEnabled = true,
  testID = 'form-wrapper',
}) => {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={[styles.container, style]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
        testID={testID}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default FormWrapper;
