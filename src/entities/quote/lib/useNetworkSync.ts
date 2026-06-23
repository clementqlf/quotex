import { quoteService } from '@/src/entities/quote/api/QuoteService';
import { STORAGE_KEYS, StorageService } from '@/src/shared/api/StorageService';
import { getExponentialBackoff } from '@/src/shared/lib/offline/backoff';
import { Quote } from '@/src/shared/api/types';
import NetInfo from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Custom hook to handle automatic synchronization of offline data when network is restored
 * 
 * Features:
 * - Monitors network connectivity state using native API
 * - Automatically triggers sync when connection is restored
 * - Uses React Query for pending count (optimized caching)
 * - Proper cleanup of all timers
 */
export interface SyncStatus {
    isConnected: boolean | null;
    isSyncing: boolean;
    lastSyncTime: Date | null;
    pendingCount: number;
    lastSyncError: string | null;
}

// Configuration des timers
const SYNC_DEBOUNCE_MS = 2000; // 2 secondes
const SYNC_INTERVAL_MS = 300000; // 5 minutes - periodic sync when online

/**
 * Clé pour la query du pending count
 */
const PENDING_COUNT_QUERY_KEY = ['pendingQuotesCount'];

/**
 * Fréquence de rafraîchissement du pending count
 * Utilisé par React Query pour le background refetch
 */
const PENDING_COUNT_REFETCH_INTERVAL_MS = 30000; // 30 secondes

export const useNetworkSync = () => {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<SyncStatus>({
        isConnected: null,
        isSyncing: false,
        lastSyncTime: null,
        pendingCount: 0,
        lastSyncError: null,
    });

    // Track if we've initialized the network listener
    const [isInitialized, setIsInitialized] = useState(false);



    // Timer pour debounced sync
    const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Timer pour periodic sync
    const periodicTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ✅ Utiliser React Query pour le pending count (meilleure optimisation)
    const { data: pendingCount = 0 } = useQuery({
        queryKey: PENDING_COUNT_QUERY_KEY,
        queryFn: () => quoteService.getPendingQuotesCount(),
        // Rafraîchir toutes les 30 secondes
        refetchInterval: PENDING_COUNT_REFETCH_INTERVAL_MS,
        // Ne pas rafraîchir en background (quand l'app est en arrière-plan)
        refetchIntervalInBackground: false,
        // Ne pas refetch si la fenêtre n'est pas active
        refetchOnWindowFocus: true,
        // Cache pour 1 minute
        staleTime: 60000,
    });

    // 🎯 Memoizer le status pour éviter les re-renders inutiles
    const memoizedStatus = useMemo(() => ({
        isConnected: status.isConnected,
        isSyncing: status.isSyncing,
        lastSyncTime: status.lastSyncTime,
        pendingCount,
        lastSyncError: status.lastSyncError,
    }), [status.isConnected, status.isSyncing, status.lastSyncTime, pendingCount, status.lastSyncError]);

    // Check if we should trigger a sync
    const shouldSync = useCallback(async (): Promise<boolean> => {
        // Don't sync if already syncing
        if (status.isSyncing) {
            console.log('[useNetworkSync] Already syncing, skipping');
            return false;
        }

        // Don't sync if not connected
        const networkState = await NetInfo.fetch();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
            console.log('[useNetworkSync] Not connected, skipping sync');
            return false;
        }

        // ✅ Vérifier le compte réel
        const actualPendingCount = await quoteService.getPendingQuotesCount();
        if (actualPendingCount === 0) {
            console.log('[useNetworkSync] No pending quotes, skipping sync');
            return false;
        }

        return true;
    }, [status.isSyncing]);

    // Track if sync is already in progress
    const syncLock = useRef(false);

    // Trigger a sync
    const triggerSync = useCallback(async () => {
        // Prevent concurrent syncs
        if (syncLock.current) {
            console.log('[useNetworkSync] Sync already in progress, skipping');
            return;
        }

        const doSync = await shouldSync();
        if (!doSync) return;

        syncLock.current = true;
        console.log('[useNetworkSync] Starting sync...');
        setStatus(prev => ({ ...prev, isSyncing: true, lastSyncError: null }));

        try {
            const result = await quoteService.syncPendingQuotes();
            
            console.log(`[useNetworkSync] Sync completed: ${result.syncedCount}/${result.total} synced`);
            
            queryClient.invalidateQueries({ queryKey: PENDING_COUNT_QUERY_KEY });
            
            setStatus(prev => ({
                ...prev,
                isSyncing: false,
                lastSyncTime: new Date(),
                lastSyncError: result.errors.length > 0 ? 
                    `Failed to sync ${result.errors.length} quotes` : null,
            }));

            await StorageService.setItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());

            // If there were errors, we might want to retry with exponential backoff
            if (result.errors.length > 0) {
                const maxRetry = Math.max(...result.errors.map((e: any) => {
                    if (e.operation) return e.operation.retryCount || 0;
                    if (e.quote && typeof e.quote === 'object') return e.quote.retryCount || 0;
                    return 0;
                }));
                const backoffDelay = getExponentialBackoff(maxRetry);
                console.log(`[useNetworkSync] Some operations failed to sync. Scheduling retry in ${backoffDelay}ms`);
                
                if (syncTimer.current) {
                    clearTimeout(syncTimer.current);
                }
                syncTimer.current = setTimeout(() => {
                    syncLock.current = false;
                    triggerSync();
                }, backoffDelay);
            } else {
                syncLock.current = false;
            }

        } catch (error: any) {
            console.error('[useNetworkSync] Sync failed:', error.message);
            setStatus(prev => ({
                ...prev,
                isSyncing: false,
                lastSyncError: error.message || 'Unknown error',
            }));
            syncLock.current = false;
        }
    }, [shouldSync, queryClient]);

    // Debounced sync trigger
    const debouncedTriggerSync = useCallback(() => {
        // Clear any existing timer
        if (syncTimer.current) {
            clearTimeout(syncTimer.current);
        }

        // Set new timer
        const timer = setTimeout(() => {
            triggerSync();
        }, SYNC_DEBOUNCE_MS);

        syncTimer.current = timer;
    }, [triggerSync]);

    // Start periodic sync when online
    const startPeriodicSync = useCallback(() => {
        if (periodicTimer.current) {
            clearInterval(periodicTimer.current);
        }

        const timer = setInterval(() => {
            triggerSync();
        }, SYNC_INTERVAL_MS);

        periodicTimer.current = timer;
        console.log('[useNetworkSync] Started periodic sync');
    }, [triggerSync]);

    // Stop periodic sync
    const stopPeriodicSync = useCallback(() => {
        if (periodicTimer.current) {
            clearInterval(periodicTimer.current);
            periodicTimer.current = null;
            console.log('[useNetworkSync] Stopped periodic sync');
        }
    }, []);

    // Manual sync trigger
    const syncNow = useCallback(() => {
        // Clear debounce and trigger immediately
        if (syncTimer.current) {
            clearTimeout(syncTimer.current);
            syncTimer.current = null;
        }
        triggerSync();
    }, [triggerSync]);

    /**
     * Clear sync corrections from quotes after animation is done
     * This prevents the typing animation from triggering repeatedly
     */
    const clearSyncCorrections = useCallback(async () => {
        const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
        const updatedQuotes = quotes.map(q => ({
            ...q,
            wasSynced: false,
            syncCorrections: undefined,
        }));
        await StorageService.setItem(STORAGE_KEYS.QUOTES, updatedQuotes);
        console.log('[useNetworkSync] Cleared sync corrections');
    }, []);

    // Load initial state
    useEffect(() => {
        const loadInitialState = async () => {
            try {
                const networkState = await NetInfo.fetch();
                const isConnected = Boolean(networkState.isConnected && networkState.isInternetReachable);
                const lastSync = await StorageService.getItem<string>(STORAGE_KEYS.LAST_SYNC_TIME);

                const isConnectedVal = Boolean(networkState.isConnected && networkState.isInternetReachable);

                setStatus({
                    isConnected: isConnectedVal,
                    isSyncing: false,
                    lastSyncTime: lastSync ? new Date(lastSync) : null,
                    pendingCount: 0, // Sera mis à jour par React Query
                    lastSyncError: null,
                });

                setIsInitialized(true);

                // If connected and has pending quotes, sync immediately
                if (isConnected && pendingCount > 0) {
                    console.log('[useNetworkSync] Connected with pending quotes, syncing...');
                    triggerSync();
                }

                // Start periodic sync if connected
                if (isConnected) {
                    startPeriodicSync();
                }

            } catch (error) {
                console.error('[useNetworkSync] Failed to load initial state:', error);
            }
        };

        loadInitialState();

        // Cleanup complet de tous les timers
        return () => {
            syncLock.current = false;
            if (syncTimer.current) {
                clearTimeout(syncTimer.current);
                syncTimer.current = null;
            }
            if (periodicTimer.current) {
                clearInterval(periodicTimer.current);
                periodicTimer.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Network state listener - utilise NetInfo.addEventListener pour du temps réel sans intervalle
    useEffect(() => {
        if (!isInitialized) return;

        const unsubscribe = NetInfo.addEventListener(state => {
            const isConnectedNow = Boolean(state.isConnected && state.isInternetReachable);
            const wasConnected = status.isConnected;

            if (wasConnected !== isConnectedNow) {
                console.log(`[useNetworkSync] Network state changed: ${wasConnected} -> ${isConnectedNow}`);
                setStatus(prev => ({ ...prev, isConnected: isConnectedNow }));

                if (wasConnected === false && isConnectedNow) {
                    console.log('[useNetworkSync] Connection restored, scheduling sync...');
                    debouncedTriggerSync();
                    startPeriodicSync();
                } else if (wasConnected === true && !isConnectedNow) {
                    stopPeriodicSync();
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, [isInitialized, status.isConnected, debouncedTriggerSync, startPeriodicSync, stopPeriodicSync]);

    // ✅ Supprimé : Plus besoin de mettre à jour le pendingCount manuellement
    // React Query le gère automatiquement avec refetchInterval

    // Clear sync corrections after animation duration (5 seconds)
    // This ensures the typing animation only plays once per sync
    useEffect(() => {
        if (pendingCount === 0 && status.lastSyncTime) {
            // After a successful sync, clear corrections after 5 seconds
            const timer = setTimeout(() => {
                clearSyncCorrections();
            }, 5000);
            
            return () => clearTimeout(timer);
        }
    }, [pendingCount, status.lastSyncTime, clearSyncCorrections]);

    // ✅ Retourner le status memoized pour éviter les re-renders inutiles
    return useMemo(() => ({
        ...memoizedStatus,
        syncNow,
        isOnline: memoizedStatus.isConnected === true,
        isOffline: memoizedStatus.isConnected === false,
    }), [memoizedStatus, syncNow]);
};

// Add to STORAGE_KEYS if not already there
declare module '@/src/shared/api/StorageService' {
    interface STORAGE_KEYS_TYPE {
        LAST_SYNC_TIME: 'last_sync_time';
    }
}

// Extend STORAGE_KEYS
const extendedKeys = {
    LAST_SYNC_TIME: 'last_sync_time',
};

export const NETWORK_SYNC_KEYS = extendedKeys;
