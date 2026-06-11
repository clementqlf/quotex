import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments, usePathname, useGlobalSearchParams } from 'expo-router';
import type { RootLayoutParams } from '@/src/shared/types/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '@/src/app/providers/AuthContext';
import { AuthGuard } from '@/src/app/providers/AuthGuard';
import { TabProvider } from '@/src/app/providers/TabContext';
import { ThemeProvider, useTheme } from '@/src/app/providers/ThemeContext';
import { RepositoriesProvider } from '@/src/app/providers/RepositoriesProvider';
import { QuoteProvider } from '@/src/entities/quote/providers/QuoteProvider';
import { AuthorProvider } from '@/src/entities/author/providers/AuthorProvider';
import { NavigationProvider } from '@/src/shared/navigation/NavigationContext';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';

import * as SplashScreen from 'expo-splash-screen';
import AnimatedSplashScreen from '@/src/shared/ui/AnimatedSplashScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Pas d'unstable_settings pour laisser Expo Router gérer les groupes dynamiquement

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <AuthGuard>
                <TabProvider>
                  <RepositoriesProvider>
                    <NavigationProvider>
                      <QuoteProvider>
                        <AuthorProvider>
                          <RootLayoutNav />
                        </AuthorProvider>
                      </QuoteProvider>
                    </NavigationProvider>
                  </RepositoriesProvider>
                </TabProvider>
              </AuthGuard>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  useEffect(() => {
    console.log("🚀 Hermes actif :", !!(global as any).HermesInternal);
  }, []);

  const { isDark, colors: themeColors } = useTheme();
  const [isSplashAnimationFinished, setIsSplashAnimationFinished] = React.useState(false);
  const { isLoading } = useAuth();
  
  // Navigation Logger avec typage
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  useEffect(() => {
    console.log(`[Navigation] Opened Screen: ${pathname}`, params);
  }, [pathname, params]);

  useEffect(() => {
    if (!isLoading) {
      // Hide the native splash screen once the auth state is determined
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Hide splash animation when auth is loaded
  useEffect(() => {
    if (!isLoading && !isSplashAnimationFinished) {
      setIsSplashAnimationFinished(true);
    }
  }, [isLoading, isSplashAnimationFinished]);

  // We are "ready" when loading is done
  const isReady = !isLoading;

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
          <Stack.Screen name="(app)" options={{ animation: 'none' }} />
          <Stack.Screen name="(auth)" />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </NavThemeProvider>
      {(!isSplashAnimationFinished) && (
        <AnimatedSplashScreen 
          isDark={isDark} 
          isLoading={isLoading}
          onAnimationFinish={() => setIsSplashAnimationFinished(true)} 
        />
      )}
    </>
  );
}
