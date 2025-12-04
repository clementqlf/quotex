import React, { useState } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import MyQuotesScreen from './screens/MyQuotesScreen';
import ScanScreen from './screens/ScanScreen';
import SocialFeedScreen from './screens/SocialFeedScreen';
import { PageIndicator } from './components/PageIndicator';
import { View, Text } from 'react-native';
import { TabIndexContext } from './TabContext'; // Importer le contexte

export type TabParamList = {
  MyQuotes: undefined;
  Scan: { currentScreen: number };
  Social: undefined;
};

const Tab = createMaterialTopTabNavigator<TabParamList>();
export function TabNavigator() {
  // We need a nested navigation state to get the tab index
  const [tabIndex, setTabIndex] = useState(1); // Start with Scan screen

  return (
    <TabIndexContext.Provider value={{ tabIndex, setTabIndex }}>
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          initialRouteName="Scan" // Démarrer sur l'écran du milieu
          tabBar={() => null} // Cacher la barre d'onglets
          screenOptions={{
            swipeEnabled: true,
          }}
          // onStateChange est déplacé vers les écrans individuels avec useIsFocused
        >
          <Tab.Screen
            name="MyQuotes"
            component={MyQuotesScreen}
            initialParams={{ index: 0 }}
          />
          <Tab.Screen 
            name="Scan" 
            component={ScanScreen}
            initialParams={{ index: 1 }}
          />
          <Tab.Screen
            name="Social"
            component={SocialFeedScreen}
            initialParams={{ index: 2 }}
          />
        </Tab.Navigator>
        <PageIndicator count={3} activeIndex={tabIndex} />
      </View>
    </TabIndexContext.Provider>
  );
}