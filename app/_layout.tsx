import React from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DataProvider } from '@/src/contexts/DataProvider';
import { ThemeProvider, useTheme } from '@/src/contexts/ThemeContext';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DataProvider>
            <RootLayoutNav />
          </DataProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const { isDark, colors: themeColors } = useTheme();

  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const navigationTheme = {
    ...baseTheme,
    dark: isDark,
    fonts: baseTheme.fonts || {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '800' },
    },
    colors: {
      ...baseTheme.colors,
      primary: themeColors.primary,
      background: themeColors.background,
      card: themeColors.surface,
      text: themeColors.text,
      border: themeColors.border,
      notification: themeColors.warning || '#EC4899',
    },
  };


  return (
    <NavThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="author-detail"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_right',
            // @ts-ignore - getId is supported by React Navigation 7/Expo Router 3+
            getId: ({ params }) => {
              let name = params?.authorName || params?.name;
              if (!name && params?.author) {
                try {
                  const p = JSON.parse(params.author);
                  name = p.name;
                } catch { name = params.author; }
              }
              return name ? String(name).toLowerCase().trim() : undefined;
            },
          }}
        />
        <Stack.Screen
          name="book-detail"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_right',
            // @ts-ignore - getId is supported by React Navigation 7/Expo Router 3+
            getId: ({ params }) => {
              let title = params?.bookTitle || params?.title;
              if (!title && params?.book) {
                try {
                  const p = JSON.parse(params.book);
                  title = p.title;
                } catch { title = params.book; }
              }
              return title ? String(title).toLowerCase().trim() : undefined;
            },
          }}
        />
        <Stack.Screen
          name="user-profile"
          options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="quote-detail"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="theme-detail"
          options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="search"
          options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="scan"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}
