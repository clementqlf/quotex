import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, AppStateStatus, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { Database } from '../types/database';

// Adaptateur FSD : SecureStore sur natif (chiffré), AsyncStorage sur web (fallback)
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key);
  },
};

// Retrieve credentials from environment variables or expo configuration extra field
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl) {
  throw new Error('Supabase URL is missing from environment variables (EXPO_PUBLIC_SUPABASE_URL) or Expo configuration');
}
if (!supabaseAnonKey) {
  throw new Error('Supabase Anon Key is missing from environment variables (EXPO_PUBLIC_SUPABASE_ANON_KEY) or Expo configuration');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Gérer le cycle de vie pour l'auto-refresh du token (recommandation officielle Supabase mobile)
AppState.addEventListener('change', (state: AppStateStatus) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
