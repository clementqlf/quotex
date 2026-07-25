import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';

export type AppTextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'quote';
export type AppTextColor = 'default' | 'secondary' | 'tertiary' | 'primary' | 'custom';

export interface AppTextProps extends RNTextProps {
  variant?: AppTextVariant;
  color?: AppTextColor;
  customColor?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  align?: TextStyle['textAlign'];
  children?: React.ReactNode;
}

export const AppText: React.FC<AppTextProps> = React.memo(({
  variant = 'body',
  color = 'default',
  customColor,
  weight,
  align,
  style,
  children,
  ...rest
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  const getTextColor = () => {
    if (customColor) return customColor;
    switch (color) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.textSecondary;
      case 'tertiary':
        return colors.textTertiary;
      default:
        return colors.text;
    }
  };

  const getVariantStyle = (): TextStyle => {
    const { fontSize, lineHeight, fontWeight, fontFamily } = tokens.typography;

    switch (variant) {
      case 'h1':
        return {
          fontSize: fontSize.heading,
          lineHeight: lineHeight.heading,
          fontWeight: weight ? fontWeight[weight] : fontWeight.bold,
        };
      case 'h2':
        return {
          fontSize: fontSize.xxl,
          lineHeight: lineHeight.xl,
          fontWeight: weight ? fontWeight[weight] : fontWeight.bold,
        };
      case 'h3':
        return {
          fontSize: fontSize.lg,
          lineHeight: lineHeight.lg,
          fontWeight: weight ? fontWeight[weight] : fontWeight.semibold,
        };
      case 'bodySmall':
        return {
          fontSize: fontSize.sm,
          lineHeight: lineHeight.sm,
          fontWeight: weight ? fontWeight[weight] : fontWeight.regular,
        };
      case 'caption':
        return {
          fontSize: fontSize.xs,
          lineHeight: lineHeight.xs,
          fontWeight: weight ? fontWeight[weight] : fontWeight.regular,
        };
      case 'quote':
        return {
          fontSize: fontSize.lg,
          lineHeight: lineHeight.lg,
          fontFamily: fontFamily.quote,
          fontStyle: 'italic',
          fontWeight: weight ? fontWeight[weight] : fontWeight.regular,
        };
      case 'body':
      default:
        return {
          fontSize: fontSize.md,
          lineHeight: lineHeight.md,
          fontWeight: weight ? fontWeight[weight] : fontWeight.regular,
        };
    }
  };

  return (
    <RNText
      style={[
        getVariantStyle(),
        { color: getTextColor() },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
});

AppText.displayName = 'AppText';
