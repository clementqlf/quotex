import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthorDetailScreen } from './components/AuthorDetail';
import { BookDetailScreen } from './components/BookDetail';
import { UserProfileScreen } from './components/UserProfileScreen';
import { RootStackParamList } from './types'; // Assurez-vous que ce fichier existe et exporte le type
import { QuoteDetailModal } from './components/QuoteDetailModal';
import { TabNavigator } from './TabNavigator'; // Importer le TabNavigator

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // On cache le header par défaut
        animation: 'slide_from_right',
        presentation: 'card', // 'card' est la transition standard
      }}
      initialRouteName="Main"
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      {/* Groupe pour les écrans qui doivent s'afficher par-dessus */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="AuthorDetail" component={AuthorDetailScreen} />
        <Stack.Screen name="BookDetail" component={BookDetailScreen} /> 
        <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        <Stack.Screen name="QuoteDetail" component={QuoteDetailModal} options={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      </Stack.Group>
    </Stack.Navigator>
  );
}