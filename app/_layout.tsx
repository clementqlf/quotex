import { AuthProvider, useAuth } from '@/src/app/providers/AuthContext';
import { AuthGuard } from '@/src/app/providers/AuthGuard';
import { RepositoriesProvider } from '@/src/app/providers/RepositoriesProvider';
import { TabProvider } from '@/src/app/providers/TabContext';
import { ThemeProvider, useTheme } from '@/src/app/providers/ThemeContext';
import { AuthorProvider } from '@/src/entities/author/providers/AuthorProvider';
import { QuoteProvider } from '@/src/entities/quote/providers/QuoteProvider';
import { NavigationProvider } from '@/src/shared/navigation/NavigationContext';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from 'expo-router/react-navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import AnimatedSplashScreen from '@/src/shared/ui/AnimatedSplashScreen';
import * as SplashScreen from 'expo-splash-screen';
import MaskedView from '@react-native-masked-view/masked-view';
import * as SystemUI from 'expo-system-ui';


// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Pas d'unstable_settings pour laisser Expo Router gérer les groupes dynamiquement

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <ThemeProvider>
            <AuthProvider>
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

  // Met à jour la couleur de fond native de la fenêtre (UIWindow) pour éviter le fond blanc derrière les modals iOS
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(themeColors.background);
  }, [themeColors.background]);

  const [isSplashAnimationFinished, setIsSplashAnimationFinished] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const { isLoading } = useAuth();
  
  // Navigation Logger avec typage
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const paramsString = JSON.stringify(params);

  const insets = useSafeAreaInsets();
  const [isLayoutReady, setIsLayoutReady] = React.useState(false);
  const [isSafeAreaReady, setIsSafeAreaReady] = React.useState(
    () => !!initialWindowMetrics || insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0
  );

  useEffect(() => {
    console.log(`[Navigation] Opened Screen: ${pathname}`, JSON.parse(paramsString));
  }, [pathname, paramsString]);

  // Track if safe area is resolved
  useEffect(() => {
    if (isSafeAreaReady) return;

    if (insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0) {
      const handle = requestAnimationFrame(() => setIsSafeAreaReady(true));
      return () => cancelAnimationFrame(handle);
    }

    const timer = setTimeout(() => {
      setIsSafeAreaReady(true);
    }, 200);

    return () => clearTimeout(timer);
  }, [insets, isSafeAreaReady]);

  // Hide the native splash screen once the auth state is determined, the layout is ready, and safe area is resolved
  useEffect(() => {
    if (!isLoading && isLayoutReady && isSafeAreaReady) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, isLayoutReady, isSafeAreaReady]);

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

  // Masque dynamique pour MaskedView
  const maskElement = React.useMemo(() => {
    if (isSplashAnimationFinished) {
      // Masque solide blanc pour révéler entièrement l'application sans démonter le Stack
      return <View style={{ flex: 1, backgroundColor: 'white' }} />;
    }
    return (
      <AnimatedSplashScreen 
        isDark={isDark} 
        isLoading={isLoading}
        isAnimating={isAnimating}
        isMask={true}
        onAnimationFinish={() => setIsSplashAnimationFinished(true)} 
      />
    );
  }, [isSplashAnimationFinished, isDark, isLoading, isAnimating]);

  return (
    <View 
      style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#FFFFFF' }} 
      onLayout={() => setIsLayoutReady(true)}
    >
      <MaskedView
        style={{ flex: 1 }}
        androidRenderingMode="software"
        maskElement={maskElement}
      >
        <AuthGuard>
          <NavThemeProvider value={navigationTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" options={{ animation: 'none' }} />
              <Stack.Screen name="(auth)" />
            </Stack>
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </NavThemeProvider>
        </AuthGuard>
      </MaskedView>
      {!isSplashAnimationFinished && (
        <AnimatedSplashScreen 
          isDark={isDark} 
          isLoading={isLoading}
          isAnimating={isAnimating}
          onAnimationStart={() => setIsAnimating(true)}
          onAnimationFinish={() => {}} 
        />
      )}
    </View>
  );
}
