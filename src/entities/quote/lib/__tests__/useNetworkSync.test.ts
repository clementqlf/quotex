import { renderHook, act } from '@testing-library/react-native';
import { useNetworkSync } from '../useNetworkSync';
import * as Network from 'expo-network';
import { quoteService } from '@/src/entities/quote/api/QuoteService';
import { StorageService } from '@/src/shared/api/StorageService';

// Mock dependencies
jest.mock('expo-network');
jest.mock('@/src/entities/quote/api/QuoteService', () => ({
  quoteService: {
    getPendingQuotesCount: jest.fn(),
    syncPendingQuotes: jest.fn(),
  },
}));
jest.mock('@/src/shared/api/StorageService', () => ({
  StorageService: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
  STORAGE_KEYS: {
    LAST_SYNC_TIME: 'last_sync_time',
    QUOTES: 'quotes',
  },
}));

describe('useNetworkSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    (quoteService.getPendingQuotesCount as jest.Mock).mockResolvedValue(0);
    (StorageService.getItem as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('devrait initialiser l\'état correctement quand en ligne et pas de citations en attente', async () => {
    const { result } = renderHook(() => useNetworkSync());

    await act(async () => {
      await Promise.resolve(); // Flush promises in useEffect
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.isSyncing).toBe(false);
    expect(quoteService.syncPendingQuotes).not.toHaveBeenCalled();
  });

  it('devrait déclencher la synchronisation si en ligne avec des citations en attente au démarrage', async () => {
    (quoteService.getPendingQuotesCount as jest.Mock).mockResolvedValue(3);
    (quoteService.syncPendingQuotes as jest.Mock).mockResolvedValue({
      syncedCount: 3,
      total: 3,
      errors: [],
    });

    const { result } = renderHook(() => useNetworkSync());

    await act(async () => {
      await Promise.resolve(); // Load initial state
      await Promise.resolve(); // let shouldSync resolve
    });

    expect(quoteService.syncPendingQuotes).toHaveBeenCalledTimes(1);
    expect(StorageService.setItem).toHaveBeenCalledWith('last_sync_time', expect.any(String));
  });

  it('devrait mettre à jour l\'état lors de la perte et la récupération de connexion', async () => {
    const { result } = renderHook(() => useNetworkSync());

    await act(async () => {
      await Promise.resolve();
    });

    // Simuler perte de connexion
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(result.current.isConnected).toBe(false);

    // Simuler retour de connexion avec une citation en attente
    (quoteService.getPendingQuotesCount as jest.Mock).mockResolvedValue(1);
    (quoteService.syncPendingQuotes as jest.Mock).mockResolvedValue({
      syncedCount: 1,
      total: 1,
      errors: [],
    });

    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    await act(async () => {
      jest.advanceTimersByTime(5000); // Check network interval
      await Promise.resolve();
    });

    expect(result.current.isConnected).toBe(true);

    // Tester la synchronisation manuelle
    await act(async () => {
      result.current.syncNow();
    });

    // Flush promises
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });

    expect(quoteService.syncPendingQuotes).toHaveBeenCalled();
  });
});
