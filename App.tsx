import React, { useEffect } from 'react';
import{  SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './AppNavigator';
import { StatusBar, NativeEventEmitter, NativeModules, StyleSheet, useColorScheme, View, Text } from 'react-native';

function App() {
  // RN 0.75 émet onAnimatedValueUpdate même sans listeners; on ajoute un listener no-op pour éviter le warn.
  const isDarkMode = useColorScheme() === 'dark';
    useEffect(() => {
    console.log("App Mounted"); // <- Vérifie si le JS démarre
  }, []);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Legacy AppContent removed: `@react-native/new-app-screen` is not installed in this project.
// If you want a template/debug screen, recreate a lightweight component here.

const styles = StyleSheet.create({
    container: {
    flex: 1,
   },
});


export default App;
