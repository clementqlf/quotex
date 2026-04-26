import React, { createContext, useState, useContext } from 'react';
import { View } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

import MyQuotesScreen from '@/screens/MyQuotesScreen';
import ScanScreen from '@/screens/ScanScreen';
import SocialFeedScreen from '@/screens/SocialFeedScreen';
import { PageIndicator } from '@/components/PageIndicator';
import { TabParamList } from '@/types';

import { TabIndexContext, SwipeEnabledContext } from '@/src/contexts/TabContext';


/* =========================
   Tab Navigator (Material Top Tabs avec swipe)
========================= */

const Tab = createMaterialTopTabNavigator<TabParamList>();

export default function Index() {
  const [tabIndex, setTabIndex] = useState(1);
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  return (
    <TabIndexContext.Provider value={{ tabIndex, setTabIndex }}>
      <SwipeEnabledContext.Provider value={{ swipeEnabled, setSwipeEnabled }}>
        <View style={{ flex: 1 }}>
          <Tab.Navigator
            initialRouteName="Scan"
            tabBar={() => null}
            screenOptions={{ swipeEnabled }}
          >
            <Tab.Screen name="MyQuotes" component={MyQuotesScreen} />
            <Tab.Screen name="Scan" component={ScanScreen} />
            <Tab.Screen name="Social" component={SocialFeedScreen} />
          </Tab.Navigator>
          <PageIndicator count={3} activeIndex={tabIndex} />
        </View>
      </SwipeEnabledContext.Provider>
    </TabIndexContext.Provider>
  );
}
