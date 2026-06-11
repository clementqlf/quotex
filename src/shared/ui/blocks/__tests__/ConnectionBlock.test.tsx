import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConnectionBlock } from '../ConnectionBlock';
import { useTheme } from '@/src/app/providers/ThemeContext';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  Link: () => 'Link',
  BookOpen: () => 'BookOpen',
  User: () => 'User',
  X: () => 'X',
}));

const mockColors = {
  primary: '#0275d8',
  text: '#000',
  textSecondary: '#666',
  textTertiary: '#999',
  surface: '#fff',
  surfaceHighlight: '#f0f0f0',
  background: '#fff',
  border: '#ddd',
};

describe('ConnectionBlock Component', () => {
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ colors: mockColors });
  });

  // --- État vide ---

  it('affiche le CTA "Lier à une ressource" quand pas de data', () => {
    const { getByText } = render(
      <ConnectionBlock blockId="conn#1" data={null} onUpdate={mockOnUpdate} />
    );
    expect(getByText('Lier à une ressource')).toBeTruthy();
    expect(getByText(/Connectez cette citation/)).toBeTruthy();
  });

  it('appelle onSearchPress au clic sur le CTA vide', () => {
    const mockOnSearch = jest.fn();
    const { getByText } = render(
      <ConnectionBlock blockId="conn#1" data={null} onUpdate={mockOnUpdate} onSearchPress={mockOnSearch} />
    );
    fireEvent.press(getByText('Lier à une ressource'));
    expect(mockOnSearch).toHaveBeenCalledTimes(1);
  });

  // --- Avec connexion livre ---

  it('affiche un livre connecté avec son titre et le label "Livre"', () => {
    const bookData = { type: 'book' as const, id: 42, title: 'Les Misérables' };
    const { getByText } = render(
      <ConnectionBlock blockId="conn#1" data={bookData} onUpdate={mockOnUpdate} />
    );
    expect(getByText('Livre')).toBeTruthy();
    expect(getByText('Les Misérables')).toBeTruthy();
  });

  // --- Avec connexion auteur ---

  it('affiche un auteur connecté avec son nom et le label "Auteur"', () => {
    const authorData = { type: 'author' as const, id: 'a1', name: 'Flaubert' };
    const { getByText } = render(
      <ConnectionBlock blockId="conn#1" data={authorData} onUpdate={mockOnUpdate} />
    );
    expect(getByText('Auteur')).toBeTruthy();
    expect(getByText('Flaubert')).toBeTruthy();
  });

  // --- Bouton Détacher ---

  it('appelle onUpdate(null) au clic sur "Détacher"', () => {
    const bookData = { type: 'book' as const, id: 42, title: 'Test' };
    const { getByText } = render(
      <ConnectionBlock blockId="conn#1" data={bookData} onUpdate={mockOnUpdate} />
    );
    fireEvent.press(getByText('Détacher'));
    expect(mockOnUpdate).toHaveBeenCalledWith(null);
  });

  // --- Navigation ---

  it('appelle onNavigate au clic sur la carte de ressource', () => {
    const mockOnNavigate = jest.fn();
    const bookData = { type: 'book' as const, id: 42, title: 'Germinal' };
    const { getByText } = render(
      <ConnectionBlock blockId="conn#1" data={bookData} onUpdate={mockOnUpdate} onNavigate={mockOnNavigate} />
    );
    fireEvent.press(getByText('Germinal'));
    expect(mockOnNavigate).toHaveBeenCalledWith('book', 42, undefined);
  });
});
