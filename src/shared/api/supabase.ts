import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Retrieve credentials from expo configuration extra field
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://neurbzkkfxrjzjykthtn.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldXJiemtrZnhyanpqeWt0aHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTc1NzcsImV4cCI6MjA5MzI5MzU3N30.vwvQQCjuIfCwcJ1vyrPt1bx09_oouKATvNQnO4axIvQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
