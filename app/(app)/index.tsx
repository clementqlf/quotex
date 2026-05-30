import React, { Suspense, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { 
  useSharedValue, 
  useEvent 
} from 'react-native-reanimated';

import { PageIndicator } from '@/src/shared/ui/PageIndicator';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

import { TabIndexContext, SwipeEnabledContext } from '@/src/app/providers/TabContext';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

const MyQuotesScreen = React.lazy(() => import('@/src/features/my-quotes/ui/MyQuotesScreen'));
const ScanScreen = React.lazy(() => import('@/src/features/scanner/ui/ScanScreen'));
const SocialFeedScreen = React.lazy(() => import('@/src/features/social/ui/SocialFeedScreen'));

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
              <Suspense fallback={<ScreenFallback />}>
                <MyQuotesScreen />
              </Suspense>
            </View>
            <View key="1">
              <Suspense fallback={<ScreenFallback />}>
                <ScanScreen />
              </Suspense>
            </View>
            <View key="2">
              <Suspense fallback={<ScreenFallback />}>
                <SocialFeedScreen />
              </Suspense>
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
