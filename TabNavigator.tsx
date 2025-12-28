import React, { createContext, useState, useContext } from 'react';
import { View } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

import MyQuotesScreen from './screens/MyQuotesScreen';
import ScanScreen from './screens/ScanScreen';
import SocialFeedScreen from './screens/SocialFeedScreen';
import { PageIndicator } from './components/PageIndicator';

/* =========================
   Contexts
========================= */

const TabIndexContext = createContext({
  tabIndex: 1,
  setTabIndex: (_index: number) => { },
});
export const useTabIndex = () => useContext(TabIndexContext);

const SwipeEnabledContext = createContext({
  swipeEnabled: true,
  setSwipeEnabled: (_enabled: boolean) => { },
});
export const useSwipeEnabled = () => useContext(SwipeEnabledContext);

/* =========================
   Navigation types
========================= */

import { TabParamList } from './types';

const Tab = createMaterialTopTabNavigator<TabParamList>();

/* =========================
   Tab Navigator
========================= */

export function TabNavigator() {
  const [tabIndex, setTabIndex] = useState(1);
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  return (
    <TabIndexContext.Provider value={{ tabIndex, setTabIndex }}>
      <SwipeEnabledContext.Provider value={{ swipeEnabled, setSwipeEnabled }}>
        <View style={{ flex: 1 }}>
          <Tab.Navigator
            initialRouteName="Scan"
            tabBar={() => null}   // ✅ LA SEULE BONNE FAÇON
            screenOptions={{
              swipeEnabled,
            }}
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
