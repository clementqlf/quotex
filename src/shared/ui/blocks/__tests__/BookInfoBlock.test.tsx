import { useTheme } from '@/src/app/providers/ThemeContext';
import { Book } from '@/src/shared/api/types';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { BookInfoBlock } from '../BookInfoBlock';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  Calendar: () => 'Calendar',
  BookOpen: () => 'BookOpen',
  Star: () => 'Star',
  X: () => 'X',
}));

const mockColors = {
  primary: '#0275d8',
  primaryLight: '#e0f7ff',
  text: '#000',
  textSecondary: '#666',
  textTertiary: '#999',
  surface: '#fff',
  surfaceHighlight: '#f0f0f0',
  border: '#ddd',
};

describe('BookInfoBlock Component', () => {
  const mockBook = {
    id: 1,
    title: 'Siddhartha',
    description: 'Un roman de Hermann Hesse.',
    cover: 'https://example.com/cover.jpg',
    year: 1922,
    pages: 152,
    rating: 4.5,
    genre: 'Roman',
    author: { id: 1, name: 'Hermann Hesse' },
  } as unknown as Book;

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ colors: mockColors });
  });

  it('affiche le message fallback quand book est null', () => {
    const { getByText } = render(<BookInfoBlock book={null} />);
    expect(getByText('Informations sur le livre non disponibles.')).toBeTruthy();
  });

  it('affiche la description en variante "description"', () => {
    const { getByText } = render(<BookInfoBlock book={mockBook} variant="description" />);
    expect(getByText('Un roman de Hermann Hesse.')).toBeTruthy();
  });

  it('affiche "Description non disponible." si pas de description', () => {
    const bookNoDesc = { ...mockBook, description: undefined } as unknown as Book;
    const { getByText } = render(<BookInfoBlock book={bookNoDesc} variant="description" />);
    expect(getByText('Description non disponible.')).toBeTruthy();
  });

  it('affiche le titre, les métadonnées et le genre en variante "info"', () => {
    const { getByText } = render(<BookInfoBlock book={mockBook} variant="info" />);
    expect(getByText('Siddhartha')).toBeTruthy();
    expect(getByText('1922')).toBeTruthy();
    expect(getByText('152 p.')).toBeTruthy();
    expect(getByText('4.5/5')).toBeTruthy();
    expect(getByText('Roman')).toBeTruthy();
  });

  it('n\'affiche pas le genre si "Unknown" ou vide', () => {
    const bookNoGenre = { ...mockBook, genre: 'Unknown' } as unknown as Book;
    const { queryByText } = render(<BookInfoBlock book={bookNoGenre} variant="info" />);
    expect(queryByText('Unknown')).toBeNull();
  });

  it('appelle onBookPress avec le titre du livre au clic', () => {
    const mockOnBookPress = jest.fn();
    const { getByText } = render(
      <BookInfoBlock book={mockBook} variant="info" onBookPress={mockOnBookPress} />
    );
    fireEvent.press(getByText('Siddhartha'));
    expect(mockOnBookPress).toHaveBeenCalledWith('Siddhartha');
  });
});
