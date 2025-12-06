import React, { createContext, useState, useContext } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import MyQuotesScreen from './screens/MyQuotesScreen';
import ScanScreen from './screens/ScanScreen';
import SocialFeedScreen from './screens/SocialFeedScreen';
import { PageIndicator } from './components/PageIndicator';
import { View, Text } from 'react-native';

// 1. Créer un contexte pour l'index de l'onglet
const TabIndexContext = createContext({
  tabIndex: 1,
  setTabIndex: (index: number) => {},
});
export const useTabIndex = () => useContext(TabIndexContext);

// 2. Créer un contexte pour contrôler le swipe
const SwipeEnabledContext = createContext({
  swipeEnabled: true,
  setSwipeEnabled: (enabled: boolean) => {},
});
export const useSwipeEnabled = () => useContext(SwipeEnabledContext);
export type TabParamList = {
  MyQuotes: undefined;
  Scan: undefined;
  Social: undefined;
};

const Tab = createMaterialTopTabNavigator<TabParamList>();

export function TabNavigator() {
  // We need a nested navigation state to get the tab index
  const [tabIndex, setTabIndex] = useState(1); // Start with Scan screen
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  return (
    <TabIndexContext.Provider value={{ tabIndex, setTabIndex }}>
    <SwipeEnabledContext.Provider value={{ swipeEnabled, setSwipeEnabled }}>
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          initialRouteName="Scan" // Démarrer sur l'écran du milieu
          tabBar={() => null} // Cacher la barre d'onglets
          screenOptions={{
            swipeEnabled: swipeEnabled,
            gestureResponseDistance: 20,
          }}
          // onStateChange est déplacé vers les écrans individuels avec useIsFocused
        >
          <Tab.Screen
            name="MyQuotes"
            component={MyQuotesScreen}
          />
          <Tab.Screen 
            name="Scan" 
            component={ScanScreen}
          />
          <Tab.Screen
            name="Social"
            component={SocialFeedScreen}
          />
        </Tab.Navigator>
        <PageIndicator count={3} activeIndex={tabIndex} />
      </View>
    </SwipeEnabledContext.Provider>
    </TabIndexContext.Provider>
  );
}