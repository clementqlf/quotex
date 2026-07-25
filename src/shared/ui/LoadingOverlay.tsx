import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';

export interface LoadingOverlayProps {
  visible: boolean;
  color?: string;
  size?: 'small' | 'large';
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  color: customColor,
  size = 'large',
}) => {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colors.backdrop,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99,
        },
      ]}
      pointerEvents="none"
    >
      <ActivityIndicator size={size} color={customColor || colors.primary} />
    </View>
  );
};

LoadingOverlay.displayName = 'LoadingOverlay';
