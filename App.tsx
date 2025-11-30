import React, { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Dimensions,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import MyQuotesScreen from './screens/MyQuotesScreen';
import ScanScreen from './screens/ScanScreen';
import SocialFeedScreen from './screens/SocialFeedScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function App() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(1); // 0=MyQuotes, 1=Scan, 2=Social

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPage(page);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled // ✅ Force la pagination écran par écran
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScroll}
        contentOffset={{ x: SCREEN_WIDTH, y: 0 }} // ✅ Démarre sur l'écran du milieu (Scan)
        decelerationRate="fast" // ✅ Snap rapide comme Snapchat
      >
        {/* Écran GAUCHE : My Quotes */}
        <View style={styles.screen}>
          <MyQuotesScreen />
        </View>

        {/* Écran MILIEU : Scan (par défaut) */}
        <View style={styles.screen}>
          <ScanScreen onNavigate={function (screen: number): void {
            throw new Error('Function not implemented.');
          } } currentScreen={0} />
        </View>

        {/* Écran DROITE : Social Feed */}
        <View style={styles.screen}>
          <SocialFeedScreen />
        </View>
      </ScrollView>

      {/* Indicateur de page (optionnel, style Snapchat) */}
      <View style={styles.pageIndicator}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentPage === index && styles.activeDot,
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
  screen: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  pageIndicator: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333',
  },
  activeDot: {
    backgroundColor: '#20B8CD',
    width: 20,
  },
});