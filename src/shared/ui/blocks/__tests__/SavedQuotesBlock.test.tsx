import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SavedQuotesBlock } from '../SavedQuotesBlock';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useAuth } from '@/src/app/providers/AuthContext';
import { Quote } from '@/src/shared/api/types';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/src/app/providers/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    FlashList: ({ data, renderItem, ListEmptyComponent }: any) => {
      if (!data || data.length === 0) {
        return ListEmptyComponent ? React.createElement(ListEmptyComponent) : null;
      }
      return React.createElement(
        View,
        { testID: 'flash-list' },
        data.map((item: any, index: number) => renderItem({ item, index }))
      );
    },
  };
});

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Defs: View,
    LinearGradient: View,
    Stop: View,
    Rect: View,
  };
});

describe('SavedQuotesBlock UI Component', () => {
  const mockQuotes: Quote[] = [
    {
      id: 1,
      text: 'First quote text',
      book: 'Book One',
      author: 'Author One',
      date: new Date().toISOString(),
      likesCount: 5,
      isLiked: false,
      user: { id: 'u1', username: 'user1' },
      isSaved: true,
    },
    {
      id: 2,
      text: 'Second quote text',
      book: 'Book Two',
      author: 'Author Two',
      date: new Date().toISOString(),
      likesCount: 2,
      isLiked: true,
      user: { id: 'u2', username: 'user2' },
      isSaved: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
      colors: {
        primary: '#000',
        text: '#111',
        textSecondary: '#666',
        textTertiary: '#999',
        surface: '#fff',
        border: '#ccc',
      },
    });
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'u1' },
    });
  });

  it('renders fallback text when quotes list is empty', () => {
    const { getByText } = render(
      <SavedQuotesBlock quotes={[]} onQuotePress={jest.fn()} />
    );
    expect(getByText('Aucune citation sauvegardée pour ce livre.')).toBeTruthy();
  });

  it('renders quotes list and triggers onQuotePress when item is clicked', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <SavedQuotesBlock quotes={mockQuotes} onQuotePress={mockOnPress} />
    );

    expect(getByText('First quote text')).toBeTruthy();
    expect(getByText('Second quote text')).toBeTruthy();

    fireEvent.press(getByText('First quote text'));
    expect(mockOnPress).toHaveBeenCalledWith(mockQuotes[0]);
  });

  it('renders filter options correctly', () => {
    const { getByText } = render(
      <SavedQuotesBlock quotes={mockQuotes} onQuotePress={jest.fn()} />
    );

    expect(getByText('Tout')).toBeTruthy();
    expect(getByText('Publiés')).toBeTruthy();
    expect(getByText('Partagées')).toBeTruthy();
  });
});
