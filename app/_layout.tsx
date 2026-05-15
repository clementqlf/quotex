import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { DataProvider } from '@/src/app/providers/DataProvider';
import { AuthProvider, useAuth } from '@/src/app/providers/AuthContext';
import { ThemeProvider, useTheme } from '@/src/app/providers/ThemeContext';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';

import * as SplashScreen from 'expo-splash-screen';
import AnimatedSplashScreen from '@/src/shared/ui/AnimatedSplashScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Pas d'unstable_settings pour laisser Expo Router gérer les groupes dynamiquement

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <DataProvider>
              <RootLayoutNav />
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  useEffect(() => {
    console.log("🚀 Hermes actif :", !!(global as any).HermesInternal);
  }, []);

  const { isDark, colors: themeColors } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const [isSplashAnimationFinished, setIsSplashAnimationFinished] = React.useState(false);
  const segments = useSegments() as any;
  const router = useRouter();
  
  // Navigation Logger
  const pathname = require('expo-router').usePathname();
  const params = require('expo-router').useGlobalSearchParams();

  useEffect(() => {
    console.log(`[Navigation] Opened Screen: ${pathname}`, params);
  }, [pathname, params]);

  useEffect(() => {
    if (!isLoading) {
      // Hide the native splash screen once the auth state is determined
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Auth Redirect Logic
  useEffect(() => {
    if (isLoading) return;

    // Detection plus robuste du groupe d'auth
    const inAuthGroup = segments.includes('(auth)') || segments.includes('login') || segments.includes('register');

    if (!isAuthenticated && !inAuthGroup) {
      console.log('[AuthDebug] Redirection vers /login');
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      console.log('[AuthDebug] Redirection vers /');
      router.replace('/');
    }
  }, [isAuthenticated, segments, isLoading]);

  const inAuthGroup = segments.includes('(auth)') || segments.includes('login') || segments.includes('register');
  // We are "ready" when loading is done AND we are on the correct side of the auth wall
  const isReady = !isLoading && ((isAuthenticated && !inAuthGroup) || (!isAuthenticated && inAuthGroup));

  // If we haven't finished the splash AND we aren't ready, 
  // show only the splash (no background app yet)
  if (!isSplashAnimationFinished && !isReady) {
    return (
      <AnimatedSplashScreen 
        isDark={isDark} 
        isLoading={true} 
        onAnimationFinish={() => setIsSplashAnimationFinished(true)} 
      />
    );
  }

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
    <>
      <NavThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="(auth)" />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </NavThemeProvider>
      {(isLoading || !isSplashAnimationFinished) && (
        <AnimatedSplashScreen 
          isDark={isDark} 
          isLoading={isLoading}
          onAnimationFinish={() => setIsSplashAnimationFinished(true)} 
        />
      )}
    </>
  );
}
