import { useTheme } from '@/src/app/providers/ThemeContext';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { SyncStatusIndicator } from '../SyncStatusIndicator';

// Mocks
jest.mock('@/src/entities/quote/providers/QuoteProvider', () => ({
  useQuote: jest.fn(),
}));

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

describe('SyncStatusIndicator Component', () => {
  const mockSyncNow = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Configuration par défaut du mock useTheme
    (useTheme as jest.Mock).mockReturnValue({
      colors: {
        warning: '#f0ad4e',
        primary: '#0275d8',
        success: '#5cb85c',
      },
    });
  });

  it('ne rend rien (null) quand isConnected est null', () => {
    (useQuote as jest.Mock).mockReturnValue({
      syncStatus: {
        isConnected: null,
      },
    });

    const { toJSON } = render(<SyncStatusIndicator />);
    expect(toJSON()).toBeNull();
  });

  it('rend l\'état hors ligne', () => {
    (useQuote as jest.Mock).mockReturnValue({
      syncStatus: {
        isConnected: false,
        isOffline: true,
        isSyncing: false,
        pendingCount: 0,
        syncNow: mockSyncNow,
      },
    });

    const { getByText } = render(<SyncStatusIndicator />);
    expect(getByText(/Hors ligne/i)).toBeTruthy();
    expect(getByText(/⚠️/i)).toBeTruthy();
  });

  it('rend l\'état de synchronisation en cours', () => {
    (useQuote as jest.Mock).mockReturnValue({
      syncStatus: {
        isConnected: true,
        isOffline: false,
        isSyncing: true,
        pendingCount: 3,
        syncNow: mockSyncNow,
      },
    });

    const { getByText } = render(<SyncStatusIndicator />);
    expect(getByText(/Synchronisation...\s*\(3\)/i)).toBeTruthy();
    expect(getByText(/🔄/i)).toBeTruthy();
  });

  it('affiche le nombre d\'éléments en attente', () => {
    (useQuote as jest.Mock).mockReturnValue({
      syncStatus: {
        isConnected: true,
        isOffline: false,
        isSyncing: false,
        pendingCount: 2,
        syncNow: mockSyncNow,
      },
    });

    const { getByText } = render(<SyncStatusIndicator />);
    expect(getByText(/2 citation\(s\) en attente/i)).toBeTruthy();
    expect(getByText(/⬆️/i)).toBeTruthy();
  });

  it('affiche l\'état en ligne avec la date de dernière synchro', () => {
    const mockDate = new Date('2026-05-31T12:00:00Z').getTime();
    
    (useQuote as jest.Mock).mockReturnValue({
      syncStatus: {
        isConnected: true,
        isOffline: false,
        isSyncing: false,
        pendingCount: 0,
        lastSyncTime: mockDate,
        syncNow: mockSyncNow,
      },
    });

    const { getByText } = render(<SyncStatusIndicator />);
    expect(getByText(/Sync:/i)).toBeTruthy();
    expect(getByText(/✓/i)).toBeTruthy();
  });

  it('déclenche syncNow lors d\'un appui sur le composant', () => {
    (useQuote as jest.Mock).mockReturnValue({
      syncStatus: {
        isConnected: true,
        isOffline: false,
        isSyncing: false,
        pendingCount: 1,
        syncNow: mockSyncNow,
      },
    });

    const { getByText } = render(<SyncStatusIndicator />);
    
    // On peut simuler l'appui sur l'élément de texte à l'intérieur du TouchableOpacity
    fireEvent.press(getByText(/1 citation\(s\) en attente/i));
    
    expect(mockSyncNow).toHaveBeenCalledTimes(1);
  });
});
