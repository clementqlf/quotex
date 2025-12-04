import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthorDetailScreen } from './components/AuthorDetail';
import { BookDetailScreen } from './components/BookDetail';
import { UserProfileScreen } from './components/UserProfileScreen';
import { QuoteDetailModal } from './components/QuoteDetailModal';
import { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator'; // Importer le TabNavigator

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="Main"
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="AuthorDetail" component={AuthorDetailScreen} />
      <Stack.Screen name="BookDetail" component={BookDetailScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="QuoteDetail" component={QuoteDetailModal} options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack.Navigator>
  );
}