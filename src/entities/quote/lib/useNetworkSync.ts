import { useState, useEffect, useCallback, useRef } from 'react';
import * as Network from 'expo-network';
import { quoteService } from '@/src/entities/quote/api/QuoteService';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import { Quote } from '@/src/shared/api/types';

/**
 * Custom hook to handle automatic synchronization of offline data when network is restored
 * 
 * Features:
 * - Monitors network connectivity state
 * - Automatically triggers sync when connection is restored
 * - Handles auth state changes
 * - Provides manual sync trigger
 * - Shows sync status
 */
export interface SyncStatus {
    isConnected: boolean | null;
    isSyncing: boolean;
    lastSyncTime: Date | null;
    pendingCount: number;
    lastSyncError: string | null;
}

const SYNC_DEBOUNCE_MS = 5000; // Wait 5 seconds after connection to avoid flaky networks
const SYNC_INTERVAL_MS = 300000; // 5 minutes - periodic sync when online

export const useNetworkSync = () => {
    const [status, setStatus] = useState<SyncStatus>({
        isConnected: null,
        isSyncing: false,
        lastSyncTime: null,
        pendingCount: 0,
        lastSyncError: null,
    });

    // Track if we've initialized the network listener
    const [isInitialized, setIsInitialized] = useState(false);

    // Track the last successful sync timestamp
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null);

    // Timer for debounced sync
    const syncTimer = useRef<NodeJS.Timeout | null>(null);
    // Timer for periodic sync
    const periodicTimer = useRef<NodeJS.Timeout | null>(null);

    // Check if we should trigger a sync
    const shouldSync = useCallback(async (): Promise<boolean> => {
        // Don't sync if already syncing
        if (status.isSyncing) {
            console.log('[useNetworkSync] Already syncing, skipping');
            return false;
        }

        // Don't sync if not connected
        if (status.isConnected === false) {
            console.log('[useNetworkSync] Not connected, skipping sync');
            return false;
        }

        // Check if we have pending quotes
        const pendingCount = await quoteService.getPendingQuotesCount();
        if (pendingCount === 0) {
            console.log('[useNetworkSync] No pending quotes, skipping sync');
            return false;
        }

        return true;
    }, [status.isSyncing, status.isConnected]);

    // Trigger a sync
    const triggerSync = useCallback(async () => {
        const doSync = await shouldSync();
        if (!doSync) return;

        console.log('[useNetworkSync] Starting sync...');
        setStatus(prev => ({ ...prev, isSyncing: true, lastSyncError: null }));

        try {
            const result = await quoteService.syncPendingQuotes();
            
            console.log(`[useNetworkSync] Sync completed: ${result.syncedCount}/${result.total} synced`);
            
            setStatus(prev => ({
                ...prev,
                isSyncing: false,
                lastSyncTime: new Date(),
                lastSyncError: result.errors.length > 0 ? 
                    `Failed to sync ${result.errors.length} quotes` : null,
                pendingCount: Math.max(0, prev.pendingCount - result.syncedCount),
            }));

            setLastSyncTimestamp(new Date().toISOString());
            await StorageService.setItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());

            // If there were errors, we might want to retry with exponential backoff
            if (result.errors.length > 0) {
                const maxRetry = Math.max(...result.errors.map(e => e.quote.retryCount || 0));
                const backoffDelay = Math.min(1000 * Math.pow(2, maxRetry), 60000); // Max 1 minute
                console.log(`[useNetworkSync] Some quotes failed to sync. Scheduling retry in ${backoffDelay}ms`);
                
                if (syncTimer.current) {
                    clearTimeout(syncTimer.current);
                }
                syncTimer.current = setTimeout(() => {
                    triggerSync();
                }, backoffDelay);
            }

        } catch (error: any) {
            console.error('[useNetworkSync] Sync failed:', error.message);
            setStatus(prev => ({
                ...prev,
                isSyncing: false,
                lastSyncError: error.message || 'Unknown error',
            }));
        }
    }, [shouldSync]);

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
                const networkState = await Network.getNetworkStateAsync();
                const isConnected = networkState.isConnected && networkState.isInternetReachable;
                const pendingCount = await quoteService.getPendingQuotesCount();
                const lastSync = await StorageService.getItem<string>(STORAGE_KEYS.LAST_SYNC_TIME);

                const isConnectedVal = networkState.isConnected && networkState.isInternetReachable;

                setStatus({
                    isConnected: isConnectedVal ?? false,
                    isSyncing: false,
                    lastSyncTime: lastSync ? new Date(lastSync) : null,
                    pendingCount,
                    lastSyncError: null,
                });

                setLastSyncTimestamp(lastSync || null);
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

        // Cleanup
        return () => {
            if (syncTimer.current) clearTimeout(syncTimer.current);
            if (periodicTimer.current) clearInterval(periodicTimer.current);
        };
    }, []);

    // Network state listener
    useEffect(() => {
        if (!isInitialized) return;

        let isMounted = true;
        const checkNetwork = async () => {
            if (!isMounted) return;
            const state = await Network.getNetworkStateAsync();
            const wasConnected = status.isConnected;
            const isConnectedNow = (state.isConnected && state.isInternetReachable) ?? false;

            if (wasConnected !== isConnectedNow) {
                console.log(`[useNetworkSync] Network state changed: ${wasConnected} -> ${isConnectedNow}`);
                setStatus(prev => ({ ...prev, isConnected: isConnectedNow }));

                if (!wasConnected && isConnectedNow) {
                    console.log('[useNetworkSync] Connection restored, scheduling sync...');
                    debouncedTriggerSync();
                    startPeriodicSync();
                } else if (wasConnected && !isConnectedNow) {
                    stopPeriodicSync();
                }
            }
        };

        const interval = setInterval(checkNetwork, 5000); // Check every 5 seconds
        checkNetwork();

        return () => {
            isMounted = false;
            clearInterval(interval);
            stopPeriodicSync();
        };
    }, [isInitialized, status.isConnected, debouncedTriggerSync, startPeriodicSync, stopPeriodicSync]);

    // Update pending count periodically
    useEffect(() => {
        const interval = setInterval(async () => {
            const count = await quoteService.getPendingQuotesCount();
            setStatus(prev => ({ ...prev, pendingCount: count }));
        }, 10000); // Update every 10 seconds

        return () => clearInterval(interval);
    }, []);

    // Clear sync corrections after animation duration (5 seconds)
    // This ensures the typing animation only plays once per sync
    useEffect(() => {
        if (status.pendingCount === 0 && status.lastSyncTime) {
            // After a successful sync, clear corrections after 5 seconds
            const timer = setTimeout(() => {
                clearSyncCorrections();
            }, 5000);
            
            return () => clearTimeout(timer);
        }
    }, [status.pendingCount, status.lastSyncTime, clearSyncCorrections]);

    return {
        ...status,
        syncNow,
        isOnline: status.isConnected === true,
        isOffline: status.isConnected === false,
    };
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
