import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Retrieve credentials from expo configuration extra field
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl) {
  throw new Error('Supabase URL is missing from Expo configuration (extra.supabaseUrl)');
}
if (!supabaseAnonKey) {
  throw new Error('Supabase Anon Key is missing from Expo configuration (extra.supabaseAnonKey)');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
