import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
} from 'react-native-reanimated';

interface Props {
  onAnimationFinish: () => void;
  isDark: boolean;
  isLoading: boolean;
}

// Logo PNG pour une performance maximale (60 FPS)
const LOGO_SOURCE = require('@/assets/images/quotex_logo.png');

export default function AnimatedSplashScreen({ onAnimationFinish, isDark, isLoading }: Props) {
  const opacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.3); // Commence plus petit pour l'effet de surgissement
  const [minTimePassed, setMinTimePassed] = React.useState(false);

  useEffect(() => {
    // 1. Entrée du logo avec un effet rebond (spring) très fluide
    logoOpacity.value = withTiming(1, { 
      duration: 500,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1)
    });
    
    logoScale.value = withSpring(1, { 
      damping: 10,     // Amortissement pour contrôler les rebonds (plus bas = plus de rebonds)
      stiffness: 80,   // Rigidité du ressort
      mass: 0.8,       // Masse du logo (plus bas = plus rapide)
    });

    // Temps d'affichage minimal pour valoriser la marque
    const timer = setTimeout(() => {
      setMinTimePassed(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [logoOpacity, logoScale]);

  useEffect(() => {
    // Ne déclencher la sortie que si le temps minimal est écoulé ET que le chargement (auth, etc.) est terminé
    if (minTimePassed && !isLoading) {
      // 2. Effet de transition : "Entrée dans le logo"
      // On fait d'abord reculer légèrement le logo (anticipation), puis on le propulse vers l'avant (zoom géant)
      logoScale.value = withSequence(
        // Recul léger (anticipation)
        withTiming(0.85, { 
          duration: 250, 
          easing: Easing.bezier(0.25, 1, 0.5, 1) 
        }),
        // Propulsion/Zoom massif
        withTiming(35, { 
          duration: 650, 
          easing: Easing.bezier(0.6, -0.05, 0.9, 0.1) // Accélération forte
        })
      );

      // Estompement du logo pendant le zoom
      logoOpacity.value = withSequence(
        withTiming(1, { duration: 250 }), // Reste opaque pendant l'anticipation
        withTiming(0, { 
          duration: 550, 
          easing: Easing.out(Easing.ease) 
        })
      );

      // Fondu de l'écran de fond noir/blanc
      opacity.value = withTiming(0, { 
        duration: 800,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
      }, (finished) => {
        if (finished) {
          runOnJS(onAnimationFinish)();
        }
      });
    }
  }, [minTimePassed, isLoading, onAnimationFinish, opacity, logoScale, logoOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
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
    ...StyleSheet.absoluteFill,
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
