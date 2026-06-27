/**
 * Calculates exponential backoff delay for retry operations
 * @param retryCount - Number of retry attempts (0-based)
 * @param maxDelay - Maximum delay in milliseconds (default: 60000 = 1 minute)
 * @returns Delay in milliseconds
 */
export const getExponentialBackoff = (retryCount: number, maxDelay = 60000): number =>
  Math.min(1000 * Math.pow(2, retryCount), maxDelay);
