import React from 'react';
import { Stack } from 'expo-router';
import { CopilotProvider } from 'react-native-copilot';
import { CustomTooltip } from '@/src/features/app-tour';
import type { 
  AuthorDetailParams, 
  BookDetailParams,
  QuoteDetailParams,
  ThemeDetailParams,
  UserProfileParams,
  SearchParams 
} from '@/src/shared/types/router';

export default function AppLayout() {
  return (
    <CopilotProvider 
      overlay="svg" 
      animated={true} 
      tooltipComponent={CustomTooltip}
      stepNumberComponent={() => null}
      tooltipStyle={{
        backgroundColor: 'transparent',
        borderRadius: 18,
        padding: 0,
        width: 290,
        overflow: 'visible',
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="author-detail"
          options={{
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="book-detail"
          options={{
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="user-profile"
          options={{ presentation: 'modal', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings"
          options={{ presentation: 'modal', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="quote-detail"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="theme-detail"
          options={{ presentation: 'modal', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="search"
          options={{ presentation: 'modal', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="scan"
          options={{ presentation: 'fullScreenModal' }}
        />
      </Stack>
    </CopilotProvider>
  );
}
