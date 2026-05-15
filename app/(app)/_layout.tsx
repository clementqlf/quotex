import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="author-detail"
        options={{
          presentation: 'modal',
          animation: 'slide_from_right',
          // @ts-ignore
          getId: ({ params }) => {
            if (params?.inventaireUri) return `uri-${params.inventaireUri}`;
            if (params?.authorId) return `id-${params.authorId}`;
            let name = params?.authorName || params?.name;
            if (!name && params?.author) {
              try {
                const p = JSON.parse(params.author);
                if (p.inventaireUri) return `uri-${p.inventaireUri}`;
                if (p.id) return `id-${p.id}`;
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
          animation: 'slide_from_right',
          // @ts-ignore
          getId: ({ params }) => {
            if (params?.inventaireUri) return `uri-${params.inventaireUri}`;
            if (params?.bookId) return `id-${params.bookId}`;
            let title = params?.bookTitle || params?.title;
            if (!title && params?.book) {
              try {
                const p = JSON.parse(params.book);
                if (p.inventaireUri) return `uri-${p.inventaireUri}`;
                if (p.id) return `id-${p.id}`;
                title = p.title;
              } catch { title = params.book; }
            }
            return title ? String(title).toLowerCase().trim() : undefined;
          },
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
          presentation: 'modal',
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
  );
}
