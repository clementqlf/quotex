import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { EditionsBlock } from '../EditionsBlock';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { httpClient } from '@/src/shared/api/HttpClient';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/src/shared/api/HttpClient', () => ({
  httpClient: {
    get: jest.fn(),
  },
}));

describe('EditionsBlock UI Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
      colors: {
        primary: '#000',
        text: '#111',
        textSecondary: '#666',
        surface: '#fff',
        surfaceHighlight: '#f5f5f5',
        border: '#ccc',
      },
    });
  });

  it('returns null when book is null or has no inventaireUri', () => {
    const { queryByText } = render(<EditionsBlock book={null} />);
    expect(queryByText('Éditions')).toBeNull();
  });

  it('renders empty message when no editions are returned from API', async () => {
    (httpClient.get as jest.Mock).mockResolvedValue([]);

    const mockBook = { id: 10, title: 'Test Book', author: 'Author', inventaireUri: 'wb:entity1' } as any;
    const { getByText } = render(<EditionsBlock book={mockBook} />);

    await waitFor(() => {
      expect(getByText('Aucune édition trouvée sur Inventaire.io')).toBeTruthy();
    });
  });

  it('fetches and renders editions list correctly', async () => {
    const mockEditions = [
      {
        id: 101,
        title: 'Édition Spéciale',
        languageUri: 'wd:Q150',
        isbn: '9782070368976',
        cover: 'http://example.com/cover.jpg',
        inventaireUri: 'wb:edition1',
      },
    ];
    (httpClient.get as jest.Mock).mockResolvedValue(mockEditions);

    const mockBook = { id: 10, title: 'Test Book', author: 'Author', inventaireUri: 'wb:entity1' } as any;
    const { getByText } = render(<EditionsBlock book={mockBook} />);

    await waitFor(() => {
      expect(getByText('Édition Spéciale')).toBeTruthy();
      expect(getByText('9782070368976')).toBeTruthy();
      expect(getByText('🇫🇷 Français')).toBeTruthy();
    });
  });
});
