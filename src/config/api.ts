import { Platform } from 'react-native';

// ─── Supabase Edge Functions URL ─────────────────────────────────────────────
// Replace 'neurbzkkfxrjzjykthtn' with your actual Supabase project ref if it changes
const SUPABASE_FUNCTIONS_URL = 'https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1';

// ─── Local dev fallback ───────────────────────────────────────────────────────
// During development, you can switch to the local Express server by setting
// USE_LOCAL_SERVER=true in your environment or toggling the flag below.
const USE_LOCAL_SERVER = false;

const LOCAL_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  ios: 'http://192.168.0.183:3000',
  default: 'http://192.168.0.183:3000',
});

export const API_BASE_URL = USE_LOCAL_SERVER ? LOCAL_URL : SUPABASE_FUNCTIONS_URL;
