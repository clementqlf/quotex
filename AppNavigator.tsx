import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthorDetailScreen } from './screens/AuthorDetail';
import { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator'; // Importer le TabNavigator

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // On cache le header par défaut
        animation: 'slide_from_right',
      }}
      initialRouteName="Main"
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="AuthorDetail" component={AuthorDetailScreen} />
    </Stack.Navigator>
  );
}