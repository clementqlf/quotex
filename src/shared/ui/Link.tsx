import React from 'react';
import { TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { AppText } from './AppText';

export type LinkVariant = 'primary' | 'secondary' | 'tertiary';
export type LinkSize = 'sm' | 'md' | 'lg';

export interface LinkProps {
  text: string;
  onPress: () => void;
  variant?: LinkVariant;
  size?: LinkSize;
  style?: ViewStyle | ViewStyle[];
  numberOfLines?: number;
  testID?: string;
  accessibilityLabel?: string;
}

export const Link: React.FC<LinkProps> = ({
  text,
  onPress,
  variant = 'primary',
  size = 'md',
  style,
  numberOfLines,
  testID,
  accessibilityLabel,
}) => {
  const { colors } = useTheme();

  const getColor = () => {
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.textSecondary;
      case 'tertiary':
        return colors.textTertiary;
      default:
        return colors.primary;
    }
  };

  const getTypographyVariant = () => {
    switch (size) {
      case 'sm':
        return 'caption' as const;
      case 'lg':
        return 'body' as const;
      case 'md':
      default:
        return 'bodySmall' as const;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={style}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      testID={testID}
      accessibilityLabel={accessibilityLabel || text}
    >
      <AppText
        variant={getTypographyVariant()}
        weight="semibold"
        customColor={getColor()}
        numberOfLines={numberOfLines}
      >
        {text}
      </AppText>
    </TouchableOpacity>
  );
};

Link.displayName = 'Link';
