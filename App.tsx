import React, { useEffect } from 'react';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './AppNavigator';
import { StatusBar, NativeEventEmitter, NativeModules, StyleSheet, useColorScheme, View } from 'react-native';
import { DataProvider } from './src/contexts/DataProvider';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

function App() {
  // RN 0.75 émet onAnimatedValueUpdate même sans listeners; on ajoute un listener no-op pour éviter le warn.
  const isDarkMode = useColorScheme() === 'dark';




  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { isDark, colors: themeColors } = useTheme();

  /* 
    React Nutrition Theme 
    We adapt our custom theme to React Navigation's theme structure.
  */
  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: themeColors.primary,
      background: themeColors.background,
      card: themeColors.surface,
      text: themeColors.text,
      border: themeColors.border,
      notification: themeColors.warning || '#EC4899',
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AppNavigator />
    </NavigationContainer>
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
