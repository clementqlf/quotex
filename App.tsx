import React from 'react';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './AppNavigator';
import { StatusBar } from 'react-native';

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar barStyle="light-content" />
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default App;
