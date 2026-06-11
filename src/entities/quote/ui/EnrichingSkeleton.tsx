import { useTheme } from '@/src/app/providers/ThemeContext';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface EnrichingSkeletonProps {
  width?: number;
  height?: number;
}

const EnrichingSkeleton = React.memo(({ width = 120, height = 14 }: EnrichingSkeletonProps) => {
  const { colors } = useTheme();
  const pulseAnim = useSharedValue(0.4);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, backgroundColor: colors.surfaceHighlight },
        pulseStyle,
      ]}
    />
  );
});

EnrichingSkeleton.displayName = 'EnrichingSkeleton';

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: 4,
    marginVertical: 4,
  },
});

export default EnrichingSkeleton;
