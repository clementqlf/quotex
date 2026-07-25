import React from 'react';
import { View, ViewStyle, Text, TextStyle } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { AppText } from './AppText';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: number;
  color?: string;
  spacing?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle | ViewStyle[];
  text?: string;
  textStyle?: TextStyle | TextStyle[];
  textColor?: string;
}

export const Divider: React.FC<DividerProps> = React.memo(({
  orientation = 'horizontal',
  thickness = 1,
  color,
  spacing = 'none',
  style,
  text,
  textStyle,
  textColor: textColorProp,
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  const getMargin = (): number => {
    switch (spacing) {
      case 'sm':
        return tokens.spacing.xs;
      case 'lg':
        return tokens.spacing.lg;
      case 'md':
        return tokens.spacing.md;
      case 'none':
      default:
        return 0;
    }
  };

  const dividerColor = color || colors.border;
  const margin = getMargin();
  const textColor = textColorProp || colors.textSecondary;

  if (text) {
    return (
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: margin,
          },
          style,
        ]}
      >
        <View
          style={{
            flex: 1,
            height: thickness,
            backgroundColor: dividerColor,
          }}
        />
        <AppText
          variant="caption"
          customColor={textColor}
          style={[
            { marginHorizontal: tokens.spacing.md, flexShrink: 1 },
            textStyle,
          ]}
        >
          {text}
        </AppText>
        <View
          style={{
            flex: 1,
            height: thickness,
            backgroundColor: dividerColor,
          }}
        />
      </View>
    );
  }

  if (orientation === 'vertical') {
    return (
      <View
        style={[
          {
            width: thickness,
            height: '100%',
            backgroundColor: dividerColor,
            marginHorizontal: margin,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          height: thickness,
          width: '100%',
          backgroundColor: dividerColor,
          marginVertical: margin,
        },
        style,
      ]}
    />
  );
});

Divider.displayName = 'Divider';
