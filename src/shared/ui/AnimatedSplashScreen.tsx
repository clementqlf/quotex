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
  onAnimationStart?: () => void;
  isAnimating?: boolean;
  isMask?: boolean;
}

// Logo PNG pour une performance maximale (60 FPS)
const LOGO_SOURCE = require('@/assets/images/quotex_logo.png');

export default function AnimatedSplashScreen({ 
  onAnimationFinish, 
  isDark, 
  isLoading,
  onAnimationStart,
  isAnimating = false,
  isMask = false
}: Props) {
  "use no memo";
  const logoScale = useSharedValue(1); // Commence à 1 pour la transition seamless
  const logoOpacity = useSharedValue(1);
  const containerOpacity = useSharedValue(1);
  const [minTimePassed, setMinTimePassed] = React.useState(false);
  const [isImageLoaded, setIsImageLoaded] = React.useState(false);

  // 1. Gestion du temps d'affichage minimal pour l'overlay statique
  useEffect(() => {
    if (!isMask) {
      const timer = setTimeout(() => {
        setMinTimePassed(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isMask]);

  // 2. Déclenchement du début de l'animation de zoom (passage à l'état de masque)
  useEffect(() => {
    if (!isMask && minTimePassed && !isLoading) {
      if (onAnimationStart) {
        onAnimationStart();
      }
    }
  }, [isMask, minTimePassed, isLoading, onAnimationStart]);

  // 3. Animation de zoom du masque et de fondu de l'overlay
  useEffect(() => {
    if (isAnimating) {
      // Zoom du logo (commun au masque et à l'overlay pour rester synchronisé)
      logoScale.value = withSequence(
        // Recul léger (anticipation)
        withTiming(0.85, { 
          duration: 250, 
          easing: Easing.bezier(0.25, 1, 0.5, 1) 
        }),
        // Propulsion/Zoom massif (55x pour recouvrir tout l'écran)
        withTiming(55, { 
          duration: 650, 
          easing: Easing.bezier(0.6, -0.05, 0.9, 0.1) // Accélération forte
        }, (finished) => {
          if (finished) {
            // Seul le masque signale la fin finale pour éviter les doubles déclenchements
            if (isMask && onAnimationFinish) {
              runOnJS(onAnimationFinish)();
            }
          }
        })
      );

      // Animations de fondu spécifiques à l'overlay (pour éviter une disparition brutale du logo blanc)
      if (!isMask) {
        // Estomper le logo blanc en fondu pendant le zoom
        logoOpacity.value = withSequence(
          withTiming(1, { duration: 250 }), // Reste visible pendant l'anticipation
          withTiming(0, { 
            duration: 550, 
            easing: Easing.out(Easing.ease) 
          })
        );

        // Fondu du fond de l'overlay après l'anticipation
        containerOpacity.value = withDelay(250, withTiming(0, { 
          duration: 450,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1)
        }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMask, isAnimating, onAnimationFinish]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: isMask ? 1 : containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: isMask ? 1 : (!isImageLoaded ? 0 : logoOpacity.value),
    transform: [{ scale: logoScale.value }],
  }));

  // Couleur de fond : transparente pour le masque, solide pour l'overlay (après chargement de l'image)
  const backgroundColor = isMask 
    ? 'transparent' 
    : (isImageLoaded ? (isDark ? '#000000' : '#FFFFFF') : 'transparent');

  return (
    <Animated.View style={[
      styles.container, 
      { backgroundColor },
      containerStyle
    ]}>
      <Animated.View style={[
        styles.logoContainer, 
        logoStyle
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
    width: 200,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  }
});
