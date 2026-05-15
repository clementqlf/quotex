import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Extract the project URL from your existing config
const supabaseUrl = 'https://neurbzkkfxrjzjykthtn.supabase.co';
// WARNING: Replace this with your actual public anon key from the Supabase dashboard
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldXJiemtrZnhyanpqeWt0aHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTc1NzcsImV4cCI6MjA5MzI5MzU3N30.vwvQQCjuIfCwcJ1vyrPt1bx09_oouKATvNQnO4axIvQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
