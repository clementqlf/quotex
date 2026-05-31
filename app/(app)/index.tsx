import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { 
  useSharedValue, 
  useEvent 
} from 'react-native-reanimated';

import { PageIndicator } from '@/src/shared/ui/PageIndicator';

import { TabIndexContext, SwipeEnabledContext } from '@/src/app/providers/TabContext';

import MyQuotesScreen from '@/src/features/my-quotes/ui/MyQuotesScreen';
import ScanScreen from '@/src/features/scanner/ui/ScanScreen';
import SocialFeedScreen from '@/src/features/social/ui/SocialFeedScreen';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export default function Index() {
  const [index, setIndex] = useState(1);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const position = useSharedValue(1);
  const pagerRef = React.useRef<PagerView>(null);

  const onPageScroll = useEvent((event: any) => {
    'worklet';
    position.value = event.position + event.offset;
  }, ['onPageScroll']);

  const onPageSelected = (e: any) => {
    setIndex(e.nativeEvent.position);
  };

  const setPage = (idx: number) => {
    if (idx !== index) {
      setIndex(idx);
      pagerRef.current?.setPage(idx);
    }
  };

  return (
    <TabIndexContext.Provider value={{ tabIndex: index, setTabIndex: setPage }}>
      <SwipeEnabledContext.Provider value={{ swipeEnabled, setSwipeEnabled }}>
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
            activeIndex={index} 
            position={position} 
          />
        </View>
      </SwipeEnabledContext.Provider>
    </TabIndexContext.Provider>
  );
}

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
