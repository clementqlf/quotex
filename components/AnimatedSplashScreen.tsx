import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  runOnJS,
  Easing,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';

interface Props {
  onAnimationFinish: () => void;
  isDark: boolean;
}

// Logo PNG pour une performance maximale (60 FPS)
const LOGO_SOURCE = require('@/assets/images/quotex_logo.png');

export default function AnimatedSplashScreen({ onAnimationFinish, isDark }: Props) {
  const opacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);

  useEffect(() => {
    // Entrée du logo
    logoOpacity.value = withTiming(1, { 
      duration: 600,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1)
    });
    
    logoScale.value = withTiming(1, { 
      duration: 800, 
      easing: Easing.out(Easing.back(1.2)) 
    });

    // Sortie après un court délai
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { 
        duration: 500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
      }, (finished) => {
        if (finished) {
          runOnJS(onAnimationFinish)();
        }
      });
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: interpolate(opacity.value, [0, 1], [1.1, 1], Extrapolation.CLAMP) }
    ]
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View style={[
      styles.container, 
      { backgroundColor: isDark ? '#000000' : '#FFFFFF' },
      containerStyle
    ]}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image 
          source={LOGO_SOURCE}
          style={styles.logo}
          contentFit="contain"
          transition={0}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logoContainer: {
    width: 250,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  }
});
