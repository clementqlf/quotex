/**
 * Safely calls EdgeRuntime.waitUntil() when available (Supabase Edge Runtime),
 * falling back to a fire-and-catch pattern for local/test environments.
 *
 * Usage: waitUntil(someAsyncFunction())
 */
export function waitUntil(promise: Promise<unknown>): void {
  const er = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil(p: Promise<unknown>): void };
  }).EdgeRuntime;
  if (er) {
    er.waitUntil(promise);
  } else {
    promise.catch(console.error);
  }
}
