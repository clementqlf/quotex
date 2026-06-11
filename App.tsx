import React from 'react';
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './AppNavigator';
import { StatusBar } from 'react-native';

function App() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default App;
