import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { useHaptics } from '@/src/shared/platform';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  enableHaptics?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = React.memo(({
  title,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  enableHaptics = true,
  onPress,
  style,
  textStyle,
  children,
  ...rest
}) => {
  const { colors, tokens = defaultTokens } = useTheme();
  const haptics = useHaptics();

  const handlePress = async (e: any) => {
    if (disabled || isLoading) return;
    if (enableHaptics) {
      try {
        await haptics.impactAsync('light');
      } catch (err) {
        // Ignore haptics errors on unsupported platforms
      }
    }
    if (onPress) {
      onPress(e);
    }
  };

  const getContainerStyle = (): ViewStyle => {
    const { spacing, radii } = tokens;

    let base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.md,
      gap: spacing.xs + 2,
    };

    // Size paddings
    switch (size) {
      case 'sm':
        base.paddingHorizontal = spacing.md;
        base.paddingVertical = spacing.xs + 2;
        break;
      case 'lg':
        base.paddingHorizontal = spacing.xl;
        base.paddingVertical = spacing.md;
        break;
      case 'md':
      default:
        base.paddingHorizontal = spacing.lg;
        base.paddingVertical = spacing.sm + 2;
        break;
    }

    // Variant colors
    switch (variant) {
      case 'secondary':
        base.backgroundColor = colors.surfaceHighlight;
        break;
      case 'outline':
        base.backgroundColor = 'transparent';
        base.borderWidth = 1;
        base.borderColor = colors.border;
        break;
      case 'ghost':
        base.backgroundColor = 'transparent';
        break;
      case 'danger':
        base.backgroundColor = colors.warning;
        break;
      case 'primary':
      default:
        base.backgroundColor = colors.primary;
        break;
    }

    if (disabled) {
      base.opacity = 0.5;
    }

    return base;
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'secondary':
        return colors.text;
      case 'outline':
        return colors.text;
      case 'ghost':
        return colors.primary;
      case 'danger':
        return '#FFFFFF';
      case 'primary':
      default:
        return colors.buttonText || '#FFFFFF';
    }
  };

  const getTextVariant = () => {
    switch (size) {
      case 'sm':
        return 'caption';
      case 'lg':
        return 'body';
      case 'md':
      default:
        return 'bodySmall';
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled || isLoading}
      onPress={handlePress}
      style={[getContainerStyle(), style]}
      accessible={true}
      accessibilityRole="button"
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {leftIcon}
          {title ? (
            <AppText
              variant={getTextVariant()}
              weight="semibold"
              customColor={getTextColor()}
              style={textStyle}
            >
              {title}
            </AppText>
          ) : (
            children
          )}
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
});

Button.displayName = 'Button';
