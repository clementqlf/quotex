import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AuthorBlock } from '../AuthorBlock';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { Author } from '@/src/shared/api/types';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  X: () => 'X',
  User: () => 'User',
}));

const mockColors = {
  primary: '#0275d8',
  text: '#000',
  textSecondary: '#666',
  textTertiary: '#999',
  surface: '#fff',
  surfaceHighlight: '#f0f0f0',
};

describe('AuthorBlock Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ colors: mockColors });
  });

  it('affiche le fallback quand ni author ni authorName ne sont fournis', () => {
    const { getByText } = render(<AuthorBlock author={null} />);
    expect(getByText("Informations sur l'auteur non disponibles.")).toBeTruthy();
  });

  it('affiche le nom de l\'auteur depuis l\'objet Author', () => {
    const author = { id: 1, name: 'Victor Hugo', description: 'Écrivain français.' } as Author;
    const { getByText } = render(<AuthorBlock author={author} />);
    expect(getByText('Victor Hugo')).toBeTruthy();
    expect(getByText('Écrivain français.')).toBeTruthy();
  });

  it('affiche le nom fourni en override (authorName) même sans objet Author', () => {
    const { getByText } = render(<AuthorBlock author={null} authorName="Albert Camus" />);
    expect(getByText('Albert Camus')).toBeTruthy();
  });

  it('affiche "Information détaillée non disponible." si pas de description', () => {
    const author = { id: 1, name: 'Anonyme' } as Author;
    const { getByText } = render(<AuthorBlock author={author} />);
    expect(getByText('Information détaillée non disponible.')).toBeTruthy();
  });

  it('appelle onAuthorPress avec le nom de l\'auteur au clic', () => {
    const mockOnPress = jest.fn();
    const author = { id: 1, name: 'Proust' } as Author;
    const { getByText } = render(<AuthorBlock author={author} onAuthorPress={mockOnPress} />);
    fireEvent.press(getByText('Proust'));
    expect(mockOnPress).toHaveBeenCalledWith('Proust');
  });
});
