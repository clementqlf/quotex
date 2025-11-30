import React, { useState } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import MyQuotesScreen from '../screens/MyQuotesScreen';
import ScanScreen from '../screens/ScanScreen';
import SocialFeedScreen from '../screens/SocialFeedScreen';

const { width } = Dimensions.get('window');

export default function SnapchatNavigator() {
  const [currentScreen, setCurrentScreen] = useState<number>(1); // 0: MyQuotes, 1: Scan, 2: Social
  const translateX = useSharedValue(-width); // Start at Scan screen

  const updateScreen = (screen: number) => {
    setCurrentScreen(screen);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const newTranslateX = -width + event.translationX;
      
      // Limit scrolling
      if (newTranslateX > 0) {
        translateX.value = 0; // Left limit (MyQuotes)
      } else if (newTranslateX < -width * 2) {
        translateX.value = -width * 2; // Right limit (Social)
      } else {
        translateX.value = newTranslateX;
      }
    })
    .onEnd((event) => {
      let targetScreen = currentScreen;
      
      if (event.velocityX > 500) {
        // Swipe right (go to previous screen)
        targetScreen = Math.max(0, currentScreen - 1);
      } else if (event.velocityX < -500) {
        // Swipe left (go to next screen)
        targetScreen = Math.min(2, currentScreen + 1);
      } else {
        // Snap to nearest screen based on position
        const position = -translateX.value / width;
        targetScreen = Math.round(position);
      }

      translateX.value = withSpring(-targetScreen * width, {
        damping: 20,
        stiffness: 90,
      });
      
      runOnJS(updateScreen)(targetScreen);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.screensContainer, animatedStyle]}>
          {/* Left Screen: My Quotes */}
          <View style={[styles.screen, { width }]}>
            <MyQuotesScreen />
          </View>

          {/* Center Screen: Scan */}
          <View style={[styles.screen, { width }]}>
            <ScanScreen />
          </View>

          {/* Right Screen: Social Feed */}
          <View style={[styles.screen, { width }]}>
            <SocialFeedScreen />
          </View>
        </Animated.View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  screensContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  screen: {
    height: '100%',
    backgroundColor: '#0F0F0F',
  },
});