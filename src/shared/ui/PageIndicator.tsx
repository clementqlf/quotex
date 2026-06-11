import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface PageIndicatorProps {
  count: number;
  activeIndex: number;
}

const ACTIVE_COLOR = '#20B8CD';
const INACTIVE_COLOR = '#6B7280';
const ACTIVE_WIDTH = 22;
const INACTIVE_WIDTH = 8;
const DOT_HEIGHT = 6;
const DURATION = 250;

function Dot({ index, activeIndex }: { index: number; activeIndex: number }) {
  const progress = useSharedValue(index === activeIndex ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(index === activeIndex ? 1 : 0, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: INACTIVE_WIDTH + progress.value * (ACTIVE_WIDTH - INACTIVE_WIDTH),
    opacity: 0.3 + progress.value * 0.7,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [INACTIVE_COLOR, ACTIVE_COLOR],
    ),
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export function PageIndicator({ count, activeIndex }: PageIndicatorProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.dotsRow}>
        {Array.from({ length: count }).map((_, i) => (
          <Dot key={i} index={i} activeIndex={activeIndex} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    height: DOT_HEIGHT,
    borderRadius: DOT_HEIGHT / 2,
    marginHorizontal: 3,
  },
});