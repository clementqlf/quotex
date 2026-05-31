import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DefinitionBlock } from '../DefinitionBlock';
import { useTheme } from '@/src/app/providers/ThemeContext';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  BookOpen: () => 'BookOpen',
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
};

describe('DefinitionBlock Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ colors: mockColors });
  });

  // --- État vide ---

  it('affiche le CTA "Cliquez pour définir des mots" quand aucune définition (mode quote)', () => {
    const { getByText } = render(<DefinitionBlock definitions={[]} />);
    expect(getByText('Cliquez pour définir des mots')).toBeTruthy();
  });

  it('affiche le fallback agrégé quand aucune définition (mode dictionnaire)', () => {
    const { getByText } = render(<DefinitionBlock definitions={[]} isAggregated={true} />);
    expect(getByText('Aucune définition visible. Cliquez pour gérer.')).toBeTruthy();
  });

  it('appelle onEditSelection au clic sur le CTA vide (mode quote)', () => {
    const mockOnEdit = jest.fn();
    const { getByText } = render(<DefinitionBlock definitions={[]} onEditSelection={mockOnEdit} />);
    fireEvent.press(getByText('Cliquez pour définir des mots'));
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  // --- Avec des définitions ---

  const sampleDefinitions = [
    {
      term: 'Solitude',
      genre: 'n.f.',
      pronunciation: '/sɔ.li.tyd/',
      etymology: 'Du latin solitudo',
      definition: 'État d\'une personne qui est seule.',
      example: '« La solitude est le berceau de la pensée. »',
      synonyms: ['isolement', 'retraite'],
    },
    {
      term: 'Solitude',
      genre: 'n.f.',
      definition: '(Figuré) Sentiment de vide intérieur.',
      example: 'Il ressentait une immense solitude.',
      synonyms: [],
    },
  ];

  it('affiche le terme en majuscules, la prononciation et le genre', () => {
    const { getByText } = render(<DefinitionBlock definitions={sampleDefinitions} />);
    expect(getByText('SOLITUDE')).toBeTruthy();
    expect(getByText('/sɔ.li.tyd/')).toBeTruthy();
    expect(getByText('n.f.')).toBeTruthy();
  });

  it('affiche les définitions numérotées', () => {
    const { getByText } = render(<DefinitionBlock definitions={sampleDefinitions} />);
    expect(getByText(/État d'une personne qui est seule/)).toBeTruthy();
    expect(getByText(/Sentiment de vide intérieur/)).toBeTruthy();
  });

  it('affiche les exemples en italique', () => {
    const { getByText } = render(<DefinitionBlock definitions={sampleDefinitions} />);
    expect(getByText(/La solitude est le berceau de la pensée/)).toBeTruthy();
  });

  it('affiche les synonymes', () => {
    const { getByText } = render(<DefinitionBlock definitions={sampleDefinitions} />);
    expect(getByText('isolement, retraite')).toBeTruthy();
  });

  it('extrait le contexte entre parenthèses dans la définition', () => {
    const { getByText } = render(<DefinitionBlock definitions={sampleDefinitions} />);
    expect(getByText(/Figuré/)).toBeTruthy();
  });

  it('affiche le bouton "Modifier la sélection" en mode non-agrégé avec onEditSelection', () => {
    const mockOnEdit = jest.fn();
    const { getByText } = render(
      <DefinitionBlock definitions={sampleDefinitions} onEditSelection={mockOnEdit} />
    );
    const btn = getByText('Modifier la sélection');
    expect(btn).toBeTruthy();
    fireEvent.press(btn);
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('n\'affiche PAS "Modifier la sélection" en mode agrégé', () => {
    const { queryByText } = render(
      <DefinitionBlock definitions={sampleDefinitions} isAggregated={true} />
    );
    expect(queryByText('Modifier la sélection')).toBeNull();
  });
});
