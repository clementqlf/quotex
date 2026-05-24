import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { ThemeColors } from '@/src/shared/theme';

type ScanFrameOverlayProps = {
  isTextDetectedLive: boolean;
  scanFrameLayout: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  colors: ThemeColors;
};

export default function ScanFrameOverlay({
  isTextDetectedLive,
  scanFrameLayout,
  colors,
}: ScanFrameOverlayProps) {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(isTextDetectedLive ? 1 : 0, { duration: 300 });
  }, [isTextDetectedLive]);

  // Animated style for the full-frame active border (snapping & fading in)
  const fullBorderAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: anim.value,
      transform: [
        { scale: 1.03 - 0.03 * anim.value }, // Scales from 1.03 down to 1.0
      ],
    };
  });

  // Animated style for the static corners (dimming when active border shows)
  const cornersAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - 0.7 * anim.value, // Dim corners to 30% opacity when active
    };
  });

  if (!scanFrameLayout) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1. Static Corners (with slight dimming animation on GPU) */}
      <Animated.View style={[StyleSheet.absoluteFill, cornersAnimatedStyle]}>
        {/* Top Left */}
        <View
          style={[
            styles.corner,
            {
              left: -3,
              top: -3,
              borderTopWidth: 3,
              borderLeftWidth: 3,
              borderTopLeftRadius: 24,
              borderColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
        />
        {/* Top Right */}
        <View
          style={[
            styles.corner,
            {
              right: -3,
              top: -3,
              borderTopWidth: 3,
              borderRightWidth: 3,
              borderTopRightRadius: 24,
              borderColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
        />
        {/* Bottom Left */}
        <View
          style={[
            styles.corner,
            {
              left: -3,
              bottom: -3,
              borderBottomWidth: 3,
              borderLeftWidth: 3,
              borderBottomLeftRadius: 24,
              borderColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
        />
        {/* Bottom Right */}
        <View
          style={[
            styles.corner,
            {
              right: -3,
              bottom: -3,
              borderBottomWidth: 3,
              borderRightWidth: 3,
              borderBottomRightRadius: 24,
              borderColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
        />
      </Animated.View>

      {/* 2. Full Active Border (GPU-accelerated fade-in + scale zoom-in) */}
      <Animated.View
        style={[
          styles.fullBorder,
          {
            borderColor: colors.primary,
            shadowColor: colors.primary,
          },
          fullBorderAnimatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    zIndex: 10,
  },
  fullBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    zIndex: 11,
  },
});
