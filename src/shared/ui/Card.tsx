import React from 'react';
import {
  View,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';

export type CardVariant = 'flat' | 'elevated' | 'outlined';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<TouchableOpacityProps, 'style'> {
  variant?: CardVariant;
  padding?: CardPadding;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = React.memo(({
  variant = 'flat',
  padding = 'md',
  onPress,
  style,
  children,
  activeOpacity = 0.75,
  ...rest
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  const getPadding = (): number => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return tokens.spacing.xs + 4;
      case 'lg':
        return tokens.spacing.lg;
      case 'md':
      default:
        return tokens.spacing.md;
    }
  };

  const getContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      backgroundColor: colors.surface,
      borderRadius: tokens.radii.lg || 12,
      padding: getPadding(),
      overflow: 'hidden',
    };

    switch (variant) {
      case 'elevated':
        return {
          ...baseStyle,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        };
      case 'outlined':
        return {
          ...baseStyle,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'flat':
      default:
        return {
          ...baseStyle,
          backgroundColor: colors.surfaceHighlight || colors.surface,
        };
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPress={onPress}
        style={[getContainerStyle(), style]}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[getContainerStyle(), style]}>
      {children}
    </View>
  );
});

Card.displayName = 'Card';
