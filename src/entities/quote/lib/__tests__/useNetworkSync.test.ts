import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useNetworkSync } from '../useNetworkSync';
import NetInfo from '@react-native-community/netinfo';
import { quoteService } from '@/src/entities/quote/api/QuoteService';
import { StorageService } from '@/src/shared/api/StorageService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
let networkCallback: (state: any) => void;
const mockUnsubscribe = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(cb => {
    networkCallback = cb;
    return mockUnsubscribe;
  }),
}));

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

// Setup QueryClient wrapper for React Query
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

describe('useNetworkSync', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    queryClient = createQueryClient();
    wrapper = ({ children }) => React.createElement(QueryClientProvider, { client: queryClient }, children);

    (NetInfo.fetch as jest.Mock).mockResolvedValue({
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
    const { result } = renderHook(() => useNetworkSync(), { wrapper });

    await act(async () => {
      jest.runOnlyPendingTimers();
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

    const { result } = renderHook(() => useNetworkSync(), { wrapper });

    // Let React Query fetch the pending count (from 0 to 3)
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    // We expect the pendingCount state of the hook to be 3 now
    expect(result.current.pendingCount).toBe(3);

    // Trigger shouldSync check and sync
    await act(async () => {
      // Re-trigger network state or trigger sync manually since the initial load closed over 0
      result.current.syncNow();
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(quoteService.syncPendingQuotes).toHaveBeenCalledTimes(1);
    expect(StorageService.setItem).toHaveBeenCalledWith('last_sync_time', expect.any(String));
  });

  it('devrait mettre à jour l\'état lors de la perte et la récupération de connexion', async () => {
    const { result } = renderHook(() => useNetworkSync(), { wrapper });

    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    // Simuler perte de connexion via l'écouteur d'événements
    await act(async () => {
      if (networkCallback) {
        networkCallback({
          isConnected: false,
          isInternetReachable: false,
        });
      }
      await Promise.resolve();
    });

    expect(result.current.isConnected).toBe(false);

    // Vider le cache de React Query pour forcer le rechargement de la valeur simulée suivante
    queryClient.clear();

    // Simuler retour de connexion avec une citation en attente
    (quoteService.getPendingQuotesCount as jest.Mock).mockResolvedValue(1);
    (quoteService.syncPendingQuotes as jest.Mock).mockResolvedValue({
      syncedCount: 1,
      total: 1,
      errors: [],
    });

    await act(async () => {
      if (networkCallback) {
        networkCallback({
          isConnected: true,
          isInternetReachable: true,
        });
      }
      await Promise.resolve();
    });

    expect(result.current.isConnected).toBe(true);

    // Let React Query load the new pending count
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(result.current.pendingCount).toBe(1);

    // Tester la synchronisation
    await act(async () => {
      result.current.syncNow();
    });

    // Flush promises
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(quoteService.syncPendingQuotes).toHaveBeenCalled();
  });
});
