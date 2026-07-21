import { useRouter } from '../useRouter';
import { usePathname, useRouter as useExpoRouter } from 'expo-router';
import { navigateOnce } from '@/src/shared/lib/pressUtils';

jest.mock('@/src/shared/lib/pressUtils', () => ({
  navigateOnce: jest.fn((cb) => cb()),
}));

describe('useRouter Hook', () => {
  const mockPush = jest.fn();
  const mockNavigate = jest.fn();
  const mockReplace = jest.fn();
  const mockBack = jest.fn();
  const mockCanGoBack = jest.fn().mockReturnValue(true);
  const mockDismiss = jest.fn();
  const mockDismissAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useExpoRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      navigate: mockNavigate,
      replace: mockReplace,
      back: mockBack,
      canGoBack: mockCanGoBack,
      dismiss: mockDismiss,
      dismissAll: mockDismissAll,
    });
    (usePathname as jest.Mock).mockReturnValue('/profile');
  });

  it('wraps push, navigate, replace, back, and navigateSingleton with navigateOnce', () => {
    const router = useRouter();

    router.push('/settings' as any);
    expect(navigateOnce).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/settings');

    router.navigate('/search' as any);
    expect(mockNavigate).toHaveBeenCalledWith('/search');

    router.replace('/home' as any);
    expect(mockReplace).toHaveBeenCalledWith('/home');

    router.back();
    expect(mockBack).toHaveBeenCalled();

    router.navigateSingleton('/scan' as any);
    expect(mockNavigate).toHaveBeenCalledWith('/scan');
  });

  it('correctly reports isAlreadyOn for matching routes', () => {
    (usePathname as jest.Mock).mockReturnValue('/profile');

    const router = useRouter();

    expect(router.isAlreadyOn('/profile')).toBe(true);
    expect(router.isAlreadyOn('/profile?query=123')).toBe(false);

    (usePathname as jest.Mock).mockReturnValue('/search?tab=books');
    const searchRouter = useRouter();
    expect(searchRouter.isAlreadyOn('/search')).toBe(true);
    expect(searchRouter.isAlreadyOn('/settings')).toBe(false);
  });

  it('preserves canGoBack, dismiss, and dismissAll', () => {
    const router = useRouter();

    expect(router.canGoBack()).toBe(true);
    expect(mockCanGoBack).toHaveBeenCalled();

    router.dismiss();
    expect(mockDismiss).toHaveBeenCalled();

    router.dismissAll();
    expect(mockDismissAll).toHaveBeenCalled();
  });
});
