import React, { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

interface BookSkeletonProps {
  colors?: ThemeColors;
  style?: any;
}

export const BookSkeleton: React.FC<BookSkeletonProps> = ({ colors: propColors, style }) => {
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
          width: 90,
          height: 135,
          borderRadius: 8,
          backgroundColor: themeColors.surfaceHighlight,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};
