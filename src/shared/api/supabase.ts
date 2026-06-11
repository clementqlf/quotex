import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Retrieve credentials from environment variables or expo configuration extra field
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl) {
  throw new Error('Supabase URL is missing from environment variables (EXPO_PUBLIC_SUPABASE_URL) or Expo configuration');
}
if (!supabaseAnonKey) {
  throw new Error('Supabase Anon Key is missing from environment variables (EXPO_PUBLIC_SUPABASE_ANON_KEY) or Expo configuration');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
