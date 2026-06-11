import { useTheme } from '@/src/app/providers/ThemeContext';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import QuoteActionModal from '../QuoteActionModal';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  X: () => 'X',
  Edit3: () => 'Edit3',
  Trash2: () => 'Trash2',
}));

describe('QuoteActionModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
      colors: {
        primary: '#0275d8',
        text: '#000',
        textSecondary: '#666',
        warning: '#f0ad4e',
        surface: '#fff',
        surfaceHighlight: '#f0f0f0',
        border: '#ddd',
        backdrop: 'rgba(0,0,0,0.5)',
      },
    });
  });

  it('affiche le titre "Options" quand la modale est visible', () => {
    const { getByText } = render(
      <QuoteActionModal visible={true} onClose={mockOnClose} onEdit={mockOnEdit} onDelete={mockOnDelete} />
    );
    expect(getByText('Options')).toBeTruthy();
  });

  it('affiche les boutons Modifier et Supprimer', () => {
    const { getByText } = render(
      <QuoteActionModal visible={true} onClose={mockOnClose} onEdit={mockOnEdit} onDelete={mockOnDelete} />
    );
    expect(getByText('Modifier')).toBeTruthy();
    expect(getByText('Supprimer')).toBeTruthy();
  });

  it('appelle onEdit puis onClose au clic sur Modifier', () => {
    const { getByText } = render(
      <QuoteActionModal visible={true} onClose={mockOnClose} onEdit={mockOnEdit} onDelete={mockOnDelete} />
    );
    fireEvent.press(getByText('Modifier'));
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('appelle onDelete puis onClose au clic sur Supprimer', () => {
    const { getByText } = render(
      <QuoteActionModal visible={true} onClose={mockOnClose} onEdit={mockOnEdit} onDelete={mockOnDelete} />
    );
    fireEvent.press(getByText('Supprimer'));
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('ne rend rien quand visible est false', () => {
    const { queryByText } = render(
      <QuoteActionModal visible={false} onClose={mockOnClose} onEdit={mockOnEdit} onDelete={mockOnDelete} />
    );
    // Le contenu de la modale n'est pas accessible quand visible=false
    expect(queryByText('Options')).toBeNull();
  });
});
