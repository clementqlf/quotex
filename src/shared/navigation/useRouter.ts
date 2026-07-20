import { useRouter as useExpoRouter, usePathname } from 'expo-router';
import { navigateOnce } from '@/src/shared/lib/pressUtils';

/**
 * Drop-in replacement for expo-router's useRouter().
 * All navigation methods (push, navigate, replace, back) are protected by
 * the global navigateOnce() singleton — so no double-navigation can happen
 * anywhere in the app, regardless of which component triggers it.
 *
 * ## Choosing push() vs navigate()
 *
 * - navigate() → Use for SINGLETON screens (Settings, UserProfile, Search, Scan).
 *   React Navigation will NOT create a duplicate entry if the screen is already in the stack.
 *   This is the correct way to prevent the same screen from opening twice.
 *
 * - push() → Use for screens that CAN legitimately appear multiple times
 *   (e.g., BookDetail → AuthorDetail → BookDetail).
 *
 * Usage: import { useRouter } from '@/src/shared/navigation/useRouter';
 */
export function useRouter() {
  const router = useExpoRouter();
  const pathname = usePathname();

  return {
    ...router,
    push: (...args: Parameters<typeof router.push>) =>
      navigateOnce(() => router.push(...args)),
    navigate: (...args: Parameters<typeof router.navigate>) =>
      navigateOnce(() => router.navigate(...args)),
    replace: (...args: Parameters<typeof router.replace>) =>
      navigateOnce(() => router.replace(...args)),
    back: () => navigateOnce(() => router.back()),
    // canGoBack and dismiss are not navigation actions — keep them unwrapped
    canGoBack: router.canGoBack.bind(router),
    dismiss: router.dismiss?.bind(router),
    dismissAll: router.dismissAll?.bind(router),
    /**
     * Navigate to a singleton screen — will NEVER create a duplicate in the stack.
     * Equivalent to navigate() but makes the intent explicit in the code.
     * Use this for: Settings, UserProfile, Search, Scan, etc.
     */
    navigateSingleton: (...args: Parameters<typeof router.navigate>) =>
      navigateOnce(() => router.navigate(...args)),
    /**
     * Returns true if the current screen already IS the target route.
     * Useful for guard checks before navigating.
     */
    isAlreadyOn: (route: string) => pathname === route || pathname.startsWith(route + '?'),
  };
}
