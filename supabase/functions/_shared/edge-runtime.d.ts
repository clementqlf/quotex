/**
 * Supabase Edge Runtime global — type declaration
 * Mirrors https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts
 * Used by any Edge Function that calls EdgeRuntime.waitUntil()
 */
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
} | undefined;
