import fs from 'fs';

// Read .env to get anon key
const envFile = fs.readFileSync('/Users/chantreau/quotex/.env', 'utf-8');
const anonKey = envFile.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];
const url = envFile.match(/EXPO_PUBLIC_SUPABASE_URL=(.*)/)[1];

console.log("URL:", url);
