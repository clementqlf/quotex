import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigationState } from '@react-navigation/native';
import MyQuotesScreen from './screens/MyQuotesScreen';
import ScanScreen from './screens/ScanScreen';
import SocialFeedScreen from './screens/SocialFeedScreen';

const Tab = createMaterialTopTabNavigator();

export function TabNavigator() {
  const index = useNavigationState(state => state.index);

  return (
    <Tab.Navigator
      initialRouteName="Scan" // Démarrer sur l'écran du milieu
      tabBar={() => null} // Cacher la barre d'onglets
      screenOptions={{
        swipeEnabled: true,
      }}
    >
      <Tab.Screen
        name="MyQuotes"
        component={MyQuotesScreen}
      />
      <Tab.Screen name="Scan">
        {(props) => <ScanScreen {...props} currentScreen={index} />}
      </Tab.Screen>
      <Tab.Screen
        name="Social"
        component={SocialFeedScreen}
      />
    </Tab.Navigator>
  );
}