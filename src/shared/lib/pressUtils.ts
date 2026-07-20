import { useCallback, useRef } from 'react';

export const DEFAULT_PRESS_DEBOUNCE_MS = 500;

/**
 * MODULE-LEVEL singleton — shared globally across ALL components.
 * Guarantees that no two navigations can fire within NAVIGATION_THROTTLE_MS,
 * regardless of which component or button triggered them.
 */
let _lastNavigationTime = 0;
const NAVIGATION_THROTTLE_MS = 500;

/**
 * Call this instead of router.push/navigate/replace directly.
 * Returns false (and does nothing) if called too soon after a previous navigation.
 */
export function navigateOnce(fn: () => void): boolean {
  const now = Date.now();
  if (now - _lastNavigationTime < NAVIGATION_THROTTLE_MS) return false;
  _lastNavigationTime = now;
  fn();
  return true;
}

/**
 * Higher-order function that wraps a callback to prevent rapid double-clicks.
 * Subsequent calls within `delay` milliseconds are safely ignored.
 * NOTE: each call to preventDoublePress() creates its own local timer.
 * For navigation use navigateOnce() instead which is globally shared.
 */
export function preventDoublePress<T extends (...args: any[]) => any>(
  fn?: T | null,
  delay: number = DEFAULT_PRESS_DEBOUNCE_MS
): (...args: Parameters<T>) => ReturnType<T> | void {
  let lastCallTime = 0;

  return (...args: Parameters<T>): ReturnType<T> | void => {
    const now = Date.now();
    if (now - lastCallTime < delay) {
      return;
    }
    lastCallTime = now;
    return fn?.(...args);
  };
}

/**
 * Custom React Hook that returns a debounced press handler.
 * Prevents rapid double-clicks within the specified delay (default 500ms).
 * Uses a per-component-instance ref — for cross-component global nav throttle use navigateOnce().
 */
export function useSinglePress<T extends (...args: any[]) => any>(
  fn?: T | null,
  delay: number = DEFAULT_PRESS_DEBOUNCE_MS,
  deps: any[] = []
): (...args: Parameters<T>) => ReturnType<T> | void {
  const lastCallTimeRef = useRef<number>(0);

  return useCallback((...args: Parameters<T>): ReturnType<T> | void => {
    const now = Date.now();
    if (now - lastCallTimeRef.current < delay) {
      return;
    }
    lastCallTimeRef.current = now;
    return fn?.(...args);
  }, [fn, delay, ...deps]);
}
