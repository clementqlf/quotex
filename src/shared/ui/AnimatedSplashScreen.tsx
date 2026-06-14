import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';

interface Props {
  onAnimationFinish: () => void;
  isDark: boolean;
  isLoading: boolean;
}

// Logo PNG pour une performance maximale (60 FPS)
const LOGO_SOURCE = require('@/assets/images/quotex_logo.png');

export default function AnimatedSplashScreen({ onAnimationFinish, isDark, isLoading }: Props) {
  "use no memo";
  const opacity = useSharedValue(1);
  const logoOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1); // Commence à 1 pour la transition seamless
  const [minTimePassed, setMinTimePassed] = React.useState(false);
  const [isImageLoaded, setIsImageLoaded] = React.useState(false);

  useEffect(() => {
    // Temps d'affichage minimal pour valoriser la marque
    const timer = setTimeout(() => {
      setMinTimePassed(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

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

      // Fondu de l'écran de fond noir/blanc (retardé de 250ms pour se déclencher quand le logo avance)
      opacity.value = withDelay(400, withTiming(0, { 
        duration: 550,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
      }, (finished) => {
        if (finished) {
          runOnJS(onAnimationFinish)();
        }
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minTimePassed, isLoading, onAnimationFinish]);

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
      { backgroundColor: isImageLoaded ? (isDark ? '#000000' : '#FFFFFF') : 'transparent' },
      containerStyle
    ]}>
      <Animated.View style={[
        styles.logoContainer, 
        logoStyle,
        { opacity: isImageLoaded ? 1 : 0 }
      ]}>
        <Image 
          source={LOGO_SOURCE}
          style={styles.logo}
          contentFit="contain"
          transition={0}
          onLoad={() => setIsImageLoaded(true)}
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
