import { useTheme } from '@/src/app/providers/ThemeContext';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

/**
 * Component to display offline/online sync status
 * Shows a small indicator at the top or bottom of the screen
 */
export const SyncStatusIndicator = () => {
    const { syncStatus } = useQuote();
    const { colors } = useTheme();

    if (syncStatus.isConnected === null) {
        return null; // Still loading
    }

    const getStatusInfo = () => {
        if (syncStatus.isOffline) {
            return {
                text: 'Hors ligne',
                color: colors.warning,
                backgroundColor: colors.warning + '20',
                icon: '⚠️',
            };
        }

        if (syncStatus.isSyncing) {
            return {
                text: `Synchronisation... (${syncStatus.pendingCount})`,
                color: colors.primary,
                backgroundColor: colors.primary + '20',
                icon: '🔄',
            };
        }

        if (syncStatus.pendingCount > 0) {
            return {
                text: `${syncStatus.pendingCount} citation(s) en attente`,
                color: colors.warning,
                backgroundColor: colors.warning + '20',
                icon: '⬆️',
            };
        }

        if (syncStatus.lastSyncTime) {
            return {
                text: `Sync: ${new Date(syncStatus.lastSyncTime).toLocaleTimeString()}`,
                color: colors.success,
                backgroundColor: colors.success + '20',
                icon: '✓',
            };
        }

        return {
            text: 'En ligne',
            color: colors.success,
            backgroundColor: colors.success + '20',
            icon: '✓',
        };
    };

    const statusInfo = getStatusInfo();

    if (!statusInfo) return null;

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: statusInfo.backgroundColor }]}
            onPress={() => syncStatus.syncNow()}
        >
            <Text style={[styles.text, { color: statusInfo.color }]}>
                {statusInfo.icon} {statusInfo.text}
            </Text>
            {syncStatus.lastSyncError && (
                <Text style={[styles.errorText, { color: colors.warning }]}>
                    Erreur: {syncStatus.lastSyncError}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        margin: 8,
        alignSelf: 'center',
    },
    text: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
    errorText: {
        fontSize: 10,
        marginTop: 2,
        textAlign: 'center',
    },
});
