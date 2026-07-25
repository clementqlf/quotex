import React from 'react';
import {
  View,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { AppText } from './AppText';

export interface InputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputContainerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const Input = React.forwardRef<RNTextInput, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  inputContainerStyle,
  inputStyle,
  style,
  placeholderTextColor,
  ...rest
}, ref) => {
  const { colors, tokens = defaultTokens } = useTheme();

  const isError = !!error;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText
          variant="caption"
          weight="medium"
          color="secondary"
          style={styles.label}
        >
          {label}
        </AppText>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inputBackground,
            borderColor: isError ? colors.warning : colors.border,
            borderRadius: tokens.radii.md,
            paddingHorizontal: tokens.spacing.md,
          },
          inputContainerStyle,
        ]}
      >
        {leftIcon ? <View style={styles.iconContainer}>{leftIcon}</View> : null}

        <RNTextInput
          ref={ref}
          placeholderTextColor={placeholderTextColor || colors.inputPlaceholder}
          style={[
            styles.input,
            {
              color: colors.inputText,
              fontSize: tokens.typography.fontSize.sm,
            },
            inputStyle,
            style,
          ]}
          {...rest}
        />

        {rightIcon ? <View style={styles.iconContainer}>{rightIcon}</View> : null}
      </View>

      {error ? (
        <AppText variant="caption" customColor={colors.warning} style={styles.helperText}>
          {error}
        </AppText>
      ) : helperText ? (
        <AppText variant="caption" color="tertiary" style={styles.helperText}>
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  helperText: {
    marginTop: 4,
  },
});
