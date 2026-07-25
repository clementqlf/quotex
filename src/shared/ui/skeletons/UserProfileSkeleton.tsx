import React from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

interface UserProfileSkeletonProps {
  colors?: ThemeColors;
  style?: any;
}

export const UserProfileSkeleton: React.FC<UserProfileSkeletonProps> = ({ colors: propColors, style }) => {
  const { colors } = useTheme();
  const themeColors = propColors || colors;
  
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={[{ flex: 1, padding: 16 }, style]}>
      <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
        <Animated.View style={[{ width: 80, height: 80, borderRadius: 40, backgroundColor: themeColors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
        <Animated.View style={[{ width: '50%', height: 26, borderRadius: 4, backgroundColor: themeColors.surfaceHighlight, marginBottom: 4 }, animatedStyle]} />
        <Animated.View style={[{ width: '30%', height: 16, borderRadius: 4, backgroundColor: themeColors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
        <Animated.View style={[{ width: '40%', height: 36, borderRadius: 8, backgroundColor: themeColors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <Animated.View style={[{ flex: 1, height: 60, borderRadius: 12, backgroundColor: themeColors.surfaceHighlight }, animatedStyle]} />
        <Animated.View style={[{ flex: 1, height: 60, borderRadius: 12, backgroundColor: themeColors.surfaceHighlight }, animatedStyle]} />
        <Animated.View style={[{ flex: 1, height: 60, borderRadius: 12, backgroundColor: themeColors.surfaceHighlight }, animatedStyle]} />
      </View>

      <Animated.View style={[{ width: '100%', height: 80, borderRadius: 16, backgroundColor: themeColors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
      <Animated.View style={[{ width: '100%', height: 120, borderRadius: 16, backgroundColor: themeColors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
    </View>
  );
};
