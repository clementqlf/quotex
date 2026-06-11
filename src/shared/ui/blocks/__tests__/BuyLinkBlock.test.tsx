import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { BuyLinkBlock } from '../BuyLinkBlock';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { Book } from '@/src/shared/api/types';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  ExternalLink: () => 'ExternalLink',
  ShoppingCart: () => 'ShoppingCart',
  ChevronRight: () => 'ChevronRight',
  X: () => 'X',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

describe('BuyLinkBlock Component', () => {
  const mockBook = {
    id: 1,
    isbn: '1234567890',
    title: 'Le Petit Prince',
    author: { id: 1, name: 'Antoine de Saint-Exupéry' },
    status: 'to_read'
  } as unknown as Book;

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
      colors: {
        primary: '#000',
        text: '#000',
        textTertiary: '#666',
        surfaceHighlight: '#eee',
        border: '#ccc',
        background: '#fff'
      },
    });

    // Mock Linking.openURL and canOpenURL
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('génère des liens de secours (fallback) si aucun buyLinks n\'est fourni', () => {
    const { getByText } = render(<BuyLinkBlock book={mockBook} />);
    
    // Vérifie que les boutiques par défaut (ex: Amazon, Fnac) sont générées
    expect(getByText(/Amazon/i)).toBeTruthy();
    expect(getByText(/Fnac/i)).toBeTruthy();
  });

  it('affiche les liens fournis dans book.buyLinks', () => {
    const bookWithLinks: Book = {
      ...mockBook,
      buyLinks: [
        { store: 'Ma Librairie', url: 'https://malibrairie.com/livre', price: 'Vérifier' }
      ]
    };

    const { getByText, queryByText } = render(<BuyLinkBlock book={bookWithLinks} />);
    
    expect(getByText('Ma Librairie')).toBeTruthy();
    // Amazon ne devrait pas y être puisque buyLinks a écrasé le fallback
    expect(queryByText('Amazon')).toBeNull();
  });

  it('tente d\'ouvrir l\'URL lors d\'un clic sur un lien d\'achat', async () => {
    const { getByText } = render(<BuyLinkBlock book={mockBook} />);
    
    // Clique sur le premier lien (Amazon généralement)
    const storeLink = getByText(/Amazon/i);
    fireEvent.press(storeLink);
    
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledTimes(1);
    });
    // Vérifie que l'URL contient le titre encodé
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('Le%20Petit%20Prince'));
  });

  it('affiche le bouton "Voir toutes les options" si plus de 2 liens existent et gère la modale', () => {
    // Le fallback par défaut génère plusieurs liens (> 2) depuis BUY_STORES
    const { getByText, queryByText } = render(<BuyLinkBlock book={mockBook} />);
    
    const seeMoreButton = getByText(/Voir toutes les options/i);
    expect(seeMoreButton).toBeTruthy();

    // La modale ne devrait pas afficher le titre au début (ou devrait être masquée)
    // En React Native Testing Library, les modales sont dans l'arbre, on peut chercher le texte "Où acheter ce livre ?"
    const modalTitleText = 'Où acheter ce livre ?';
    
    // Clique pour ouvrir la modale
    fireEvent.press(seeMoreButton);
    expect(getByText(modalTitleText)).toBeTruthy();
    
    // Ferme la modale
    // On trouve le bouton de fermeture, pas évident sans testID, mais on peut chercher d'autres moyens
    // ou on se contente de vérifier que l'ouverture a fonctionné.
  });
});
