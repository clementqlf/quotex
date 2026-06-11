import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import BookCardItem from '../BookCardItem';

// Mocks des hooks personnalisés de navigation et de thème
const mockNavigateToBook = jest.fn();
jest.mock('@/src/shared/lib/hooks/useSmartNavigation', () => ({
  useSmartNavigation: () => ({
    navigateToBook: mockNavigateToBook,
  }),
}));

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#ffffff',
      surfaceHighlight: '#f3f4f6',
      border: '#e5e7eb',
      text: '#111827',
      textSecondary: '#4b5563',
      textTertiary: '#9ca3af',
      primary: '#3b82f6',
    },
  }),
}));

const mockBook = {
  id: 101,
  title: 'L’Étranger',
  authors: ['Albert Camus'],
  quoteCount: 12,
  year: 1942,
  description: 'Un roman majeur de la littérature française du XXe siècle.',
  readingStatus: 'READ',
  cover: 'https://example.com/cover.jpg',
};

describe('<BookCardItem />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('affiche correctement le titre, l’auteur et le nombre de citations', () => {
    const { getByText } = render(<BookCardItem book={mockBook} />);

    expect(getByText('L’Étranger')).toBeTruthy();
    expect(getByText('Albert Camus')).toBeTruthy();
    expect(getByText('12 citations')).toBeTruthy();
    expect(getByText('1942')).toBeTruthy();
  });

  test('affiche le badge de statut de lecture correct', () => {
    const { getByText } = render(<BookCardItem book={mockBook} />);
    expect(getByText('Lu')).toBeTruthy();
  });

  test('appelle la fonction navigateToBook au clic sur la carte du livre', () => {
    const { getByText } = render(<BookCardItem book={mockBook} />);
    
    // Cliquer sur le titre du livre
    fireEvent.press(getByText('L’Étranger'));

    expect(mockNavigateToBook).toHaveBeenCalledWith(101, undefined);
  });

  test('affiche "Auteur inconnu" s’il n’y a pas d’auteurs', () => {
    const bookWithoutAuthor = {
      ...mockBook,
      authors: [],
    };
    const { getByText } = render(<BookCardItem book={bookWithoutAuthor} />);
    expect(getByText('Auteur inconnu')).toBeTruthy();
  });
});
