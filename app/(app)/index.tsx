import React from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated from 'react-native-reanimated';

import { PageIndicator } from '@/src/shared/ui/PageIndicator';
import { useTabController } from '@/src/app/providers/TabContext';

import MyQuotesScreen from '@/src/features/my-quotes/ui/MyQuotesScreen';
import ScanScreen from '@/src/features/scanner/ui/ScanScreen';
import SocialFeedScreen from '@/src/features/social/ui/SocialFeedScreen';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export default function Index() {
  const { 
    tabIndex, 
    swipeEnabled, 
    position, 
    pagerRef, 
    onPageScroll, 
    onPageSelected,
  } = useTabController();

  return (
    <View style={{ flex: 1 }}>
      <AnimatedPagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={1}
        onPageScroll={onPageScroll}
        onPageSelected={onPageSelected}
        scrollEnabled={swipeEnabled}
      >
        <View key="0">
          <MyQuotesScreen />
        </View>
        <View key="1">
          <ScanScreen />
        </View>
        <View key="2">
          <SocialFeedScreen />
        </View>
      </AnimatedPagerView>

      <PageIndicator 
        count={3} 
        activeIndex={tabIndex} 
        position={position} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
