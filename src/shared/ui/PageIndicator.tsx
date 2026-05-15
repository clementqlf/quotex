import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  SharedValue,
  interpolateColor
} from 'react-native-reanimated';

interface PageIndicatorProps {
  count: number;
  activeIndex: number;
  position: SharedValue<number>;
}

function Dot({ index, position }: { index: number; position: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(position.value - index);
    const opacity = Math.max(0.3, 1 - distance * 0.7);
    const width = distance < 1 ? 8 + (1 - distance) * 14 : 8;
    
    // Smooth color diffusion
    const backgroundColor = interpolateColor(
      distance,
      [0, 1],
      ['#20B8CD', '#6B7280']
    );
    
    return {
      opacity,
      width,
      backgroundColor,
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export function PageIndicator({ count, activeIndex, position }: PageIndicatorProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.dotsRow}>
        {Array.from({ length: count }).map((_, i) => (
          <Dot key={i} index={i} position={position} />
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
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
});