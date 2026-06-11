import React from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { useSwipeEnabled, useTabIndex } from '@/src/app/providers/TabContext';
import { useAppTour } from '@/src/features/app-tour';
import { PageIndicator } from '@/src/shared/ui/PageIndicator';

import MyQuotesScreen from '@/src/features/my-quotes/ui/MyQuotesScreen';
import ScanScreen from '@/src/features/scanner/ui/ScanScreen';
import SocialFeedScreen from '@/src/features/social/ui/SocialFeedScreen';

export default function Index() {
  const { 
    tabIndex, 
    pagerRef, 
    onPageSelected,
  } = useTabIndex();
  const { swipeEnabled } = useSwipeEnabled();
  
  // Démarrer la gestion globale du cycle de vie du tutoriel
  useAppTour();

  return (
    <View style={{ flex: 1 }}>
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={1}
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
      </PagerView>

      <PageIndicator 
        count={3} 
        activeIndex={tabIndex} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
