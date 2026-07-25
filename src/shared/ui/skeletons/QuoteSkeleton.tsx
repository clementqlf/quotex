import React, { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

interface QuoteSkeletonProps {
  colors?: ThemeColors;
  style?: any;
  width?: string | number;
  height?: number;
}

export const QuoteSkeleton: React.FC<QuoteSkeletonProps> = ({
  colors: propColors,
  style,
  width = '100%',
  height = 100,
}) => {
  const { colors } = useTheme();
  const themeColors = propColors || colors;
  const [pulseAnim] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: 12,
          backgroundColor: themeColors.surfaceHighlight,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};
