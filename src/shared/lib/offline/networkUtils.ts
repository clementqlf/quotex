import NetInfo from '@react-native-community/netinfo';

/**
 * Checks if the device is currently offline.
 */
export async function isOffline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === false;
  } catch {
    // If NetInfo fails, assume online to let requests try and fail naturally
    return false;
  }
}

/**
 * Helper to check if a thrown error is a network connectivity error.
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const message = error.message || String(error);
  const name = error.name || '';
  return (
    message.includes('Network request failed') ||
    message.includes('NetworkError') ||
    message.includes('Failed to fetch') ||
    message.includes('Aborted') ||
    message.includes('AbortError') ||
    message.toLowerCase().includes('canceled') ||
    message.toLowerCase().includes('cancelled') ||
    name === 'AbortError'
  );
}

/**
 * Logs a fetch/API error to the console.
 * Downgrades network connectivity errors to warnings so they do not trigger red screens in development.
 */
export function logFetchError(context: string, error: any): void {
  if (isNetworkError(error)) {
    console.warn(`[Network/Offline] ${context} (Expected offline behavior):`, error.message || error);
  } else {
    console.error(`${context}:`, error);
  }
}
