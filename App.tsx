import React, { useRef, useState } from 'react';
import {
  View,
  Dimensions,
  PanResponder,
  Animated,
  StyleSheet,
} from 'react-native';
import MyQuotesScreen from './screens/MyQuotesScreen';
import ScanScreen from './screens/ScanScreen';
import SocialFeedScreen from './screens/SocialFeedScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(1); // 0: Mes Citations, 1: Scanner, 2: Feed Social
  const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(-SCREEN_WIDTH * currentScreen + gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = SCREEN_WIDTH / 4;
        
        if (gestureState.dx > swipeThreshold && currentScreen > 0) {
          // Swipe right
          goToScreen(currentScreen - 1);
        } else if (gestureState.dx < -swipeThreshold && currentScreen < 2) {
          // Swipe left
          goToScreen(currentScreen + 1);
        } else {
          // Snap back
          goToScreen(currentScreen);
        }
      },
    })
  ).current;

  const goToScreen = (screen: number) => {
    setCurrentScreen(screen);
    Animated.spring(translateX, {
      toValue: -SCREEN_WIDTH * screen,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start();
  };

  return (
    <View style={styles.container}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.screensContainer,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
          <MyQuotesScreen />
        </View>
        <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
          <ScanScreen onNavigate={goToScreen} currentScreen={currentScreen} />
        </View>
        <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
          <SocialFeedScreen />
        </View>
      </Animated.View>

      {/* Navigation Indicators */}
      <View style={styles.indicators}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              currentScreen === index ? styles.indicatorActive : styles.indicatorInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  screensContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  screen: {
    flex: 1,
  },
  indicators: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  indicator: {
    height: 6,
    borderRadius: 3,
  },
  indicatorActive: {
    width: 32,
    backgroundColor: '#20B8CD',
  },
  indicatorInactive: {
    width: 6,
    backgroundColor: '#4B5563',
  },
});