import React from 'react';
import { render } from '@testing-library/react-native';
import { BlockDispatcher } from '../BlockDispatcher';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { View } from 'react-native';

// Mocks des hooks
jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

// Mocks des sous-composants pour isoler le test du Dispatcher
jest.mock('../BuyLinkBlock', () => ({
  BuyLinkBlock: () => <View testID="mock-buy-block" />
}));

jest.mock('../NotesBlock', () => ({
  NotesBlock: ({ onUpdate }: any) => {
    // Simuler un appel de callback via une fonction attachée aux props
    return <View testID="mock-notes-block" onTouchEnd={() => onUpdate('Nouveau texte')} />
  }
}));

describe('BlockDispatcher Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
      colors: { warning: '#ff0000', text: '#000' }
    });
  });

  it('ne rend rien (null) pour le bloc "buy" si book n\'est pas fourni', () => {
    const { toJSON } = render(<BlockDispatcher blockId="buy" context={{}} />);
    expect(toJSON()).toBeNull();
  });

  it('rend le BuyLinkBlock pour la clé "buy" quand un livre est fourni', () => {
    const { getByTestId } = render(
      <BlockDispatcher 
        blockId="buy" 
        context={{ 
          book: { id: '1', title: 'Test', isbn: '1', status: 'to_read', author: { id: 'a1', name: 'Auteur' } } as any 
        }} 
      />
    );
    expect(getByTestId('mock-buy-block')).toBeTruthy();
  });

  it('extrait correctement la baseKey si blockId contient un dièse (#)', () => {
    // Par exemple "notes#123" devrait appeler le cas "notes"
    const { getByTestId } = render(
      <BlockDispatcher 
        blockId="notes#123" 
        context={{}} 
      />
    );
    expect(getByTestId('mock-notes-block')).toBeTruthy();
  });

  it('passe les callbacks de contexte correctement (ex: onUpdateBlockData pour notes)', () => {
    const mockOnUpdate = jest.fn();
    const { getByTestId } = render(
      <BlockDispatcher 
        blockId="notes#123" 
        context={{ onUpdateBlockData: mockOnUpdate }} 
      />
    );
    
    const notesBlock = getByTestId('mock-notes-block');
    // On simule l'action qui déclencherait onUpdate dans le mock
    notesBlock.props.onTouchEnd();
    
    expect(mockOnUpdate).toHaveBeenCalledWith('notes#123', 'Nouveau texte');
  });

  it('affiche un message d\'erreur pour une clé de bloc inconnue', () => {
    const { getByText } = render(
      <BlockDispatcher blockId="invalidBlockKey" context={{}} />
    );
    
    expect(getByText(/Unknown Block: invalidBlockKey/)).toBeTruthy();
  });
});
