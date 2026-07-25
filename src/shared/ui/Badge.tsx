import React from 'react';
import {
  View,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { AppText } from './AppText';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'outline'
  | 'success'
  | 'warning';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  label?: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = React.memo(({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  onPress,
  style,
  textStyle,
  children,
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    const isSm = size === 'sm';
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: tokens.radii.full || 999,
      paddingHorizontal: isSm ? tokens.spacing.xs + 2 : tokens.spacing.sm + 2,
      paddingVertical: isSm ? 2 : tokens.spacing.xs,
      gap: 4,
    };

    switch (variant) {
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: colors.surfaceHighlight,
        };
      case 'accent':
        return {
          ...baseStyle,
          backgroundColor: colors.accent ? `${colors.accent}1F` : colors.surfaceHighlight,
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'success':
        return {
          ...baseStyle,
          backgroundColor: colors.success ? `${colors.success}20` : '#E6F4EA',
        };
      case 'warning':
        return {
          ...baseStyle,
          backgroundColor: colors.warning ? `${colors.warning}20` : '#FEF7E0',
        };
      case 'primary':
      default:
        return {
          ...baseStyle,
          backgroundColor: `${colors.primary}1F`,
        };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'secondary':
        return colors.textSecondary || colors.text;
      case 'accent':
        return colors.accent || colors.primary;
      case 'outline':
        return colors.textSecondary || colors.text;
      case 'success':
        return colors.success || '#137333';
      case 'warning':
        return colors.warning || '#B06000';
      case 'primary':
      default:
        return colors.primary;
    }
  };

  const content = (
    <>
      {icon}
      {label ? (
        <AppText
          variant={size === 'sm' ? 'caption' : 'caption'}
          weight="semibold"
          customColor={getTextColor()}
          style={textStyle}
        >
          {label}
        </AppText>
      ) : (
        children
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[getContainerStyle(), style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[getContainerStyle(), style]}>
      {content}
    </View>
  );
});

Badge.displayName = 'Badge';
