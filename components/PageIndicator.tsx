import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

interface PageIndicatorProps {
  count: number;
  activeIndex: number;
}

function Dot({ active }: { active: boolean }) {
  const width = useRef(new Animated.Value(active ? 32 : 6)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: active ? 32 : 6,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [active, width]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { width },
        active ? styles.activeDot : styles.inactiveDot,
      ]}
    />
  );
}

export function PageIndicator({ count, activeIndex }: PageIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <Dot key={index} active={activeIndex === index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 8, // Similaire à 'gap-2' en Tailwind
  },
  dot: {
    height: 6, // Similaire à 'h-1.5'
    borderRadius: 3, // Similaire à 'rounded-full'
  },
  activeDot: {
    backgroundColor: '#20B8CD', // Couleur cyan du thème
  },
  inactiveDot: {
    backgroundColor: '#6B7280', // Similaire à 'bg-gray-600'
  },
});