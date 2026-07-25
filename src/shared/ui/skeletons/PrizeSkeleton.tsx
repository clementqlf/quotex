import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ThemeColors } from '@/src/shared/theme';

export const PrizeSkeleton = ({ colors }: { colors: ThemeColors }) => {
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
    <View style={{ flex: 1, padding: 16 }}>
       <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
          <Animated.View style={[{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
          <Animated.View style={[{ width: '60%', height: 28, borderRadius: 4, backgroundColor: colors.surfaceHighlight, marginBottom: 8 }, animatedStyle]} />
       </View>
       
       <Animated.View style={[{ width: '100%', height: 120, borderRadius: 16, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
       <Animated.View style={[{ width: '100%', height: 80, borderRadius: 16, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
       
       <Animated.View style={[{ width: '30%', height: 24, borderRadius: 4, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
       <Animated.View style={[{ width: '100%', height: 100, borderRadius: 12, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
       <Animated.View style={[{ width: '100%', height: 100, borderRadius: 12, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
    </View>
  );
};
