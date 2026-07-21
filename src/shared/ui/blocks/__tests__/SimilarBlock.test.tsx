import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SimilarBlock } from '../SimilarBlock';
import { useTheme } from '@/src/app/providers/ThemeContext';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

describe('SimilarBlock UI Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
      colors: {
        primary: '#000',
        text: '#111',
        textSecondary: '#666',
        surface: '#fff',
        border: '#ccc',
      },
    });
  });

  it('renders fallback text when items list is empty for books', () => {
    const { getByText } = render(
      <SimilarBlock type="book" items={[]} onPress={jest.fn()} />
    );
    expect(getByText('Aucun livre similaire trouvé.')).toBeTruthy();
  });

  it('renders fallback text when items list is empty for authors', () => {
    const { getByText } = render(
      <SimilarBlock type="author" items={[]} onPress={jest.fn()} />
    );
    expect(getByText('Aucun auteur similaire trouvé.')).toBeTruthy();
  });

  it('renders list of similar books and handles press interaction', () => {
    const mockOnPress = jest.fn();
    const mockItems = [
      { id: 1, title: 'Book A', inventaireUri: 'wb:a' },
      { id: 2, title: 'Book B', inventaireUri: 'wb:b' },
    ];

    const { getByText } = render(
      <SimilarBlock type="book" items={mockItems} onPress={mockOnPress} />
    );

    expect(getByText('Book A')).toBeTruthy();
    expect(getByText('Book B')).toBeTruthy();

    fireEvent.press(getByText('Book A'));
    expect(mockOnPress).toHaveBeenCalledWith(1, 'wb:a');
  });

  it('renders list of similar authors', () => {
    const mockOnPress = jest.fn();
    const mockItems = [
      { id: 10, title: 'Albert Camus' },
      { id: 20, title: 'Jean-Paul Sartre' },
    ];

    const { getByText } = render(
      <SimilarBlock type="author" items={mockItems} onPress={mockOnPress} />
    );

    expect(getByText('Albert Camus')).toBeTruthy();
    expect(getByText('Jean-Paul Sartre')).toBeTruthy();

    fireEvent.press(getByText('Albert Camus'));
    expect(mockOnPress).toHaveBeenCalledWith('Albert Camus', undefined);
  });
});
