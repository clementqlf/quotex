/**
 * modalScrollSync (shared/lib)
 *
 * Stores a reference to the modal's Animated.ScrollView (Reanimated)
 * so that any layer can trigger an immediate scroll via the UI thread.
 *
 * FSD: placed in shared so both entities and features can use it
 * without creating cross-layer imports.
 */
import { scrollTo } from 'react-native-reanimated';
import type { AnimatedRef } from 'react-native-reanimated';
import type { ScrollView } from 'react-native';

type ScrollToFn = (y: number, animated?: boolean) => void;

let _scrollTo: ScrollToFn | null = null;
let _animatedRef: AnimatedRef<ScrollView> | null = null;

export const registerModalScrollHandler = (fn: ScrollToFn): void => {
  _scrollTo = fn;
};

export const registerModalScrollRef = (ref: AnimatedRef<ScrollView>): void => {
  _animatedRef = ref;
};

export const unregisterModalScrollHandler = (): void => {
  _scrollTo = null;
  _animatedRef = null;
};

/**
 * Scroll to y immediately on the UI thread using Reanimated's scrollTo.
 * Falls back to the JS-thread scrollTo if the Reanimated ref is not registered.
 */
export const triggerModalScrollTo = (y: number, animated = true): void => {
  if (_animatedRef) {
    // Reanimated scrollTo runs on the UI thread — effectively synchronous
    scrollTo(_animatedRef as any, 0, y, animated);
  } else {
    _scrollTo?.(y, animated);
  }
};
