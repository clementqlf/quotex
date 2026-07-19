import { useTheme } from '@/src/app/providers/ThemeContext';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { DefinitionBlock } from '../DefinitionBlock';

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

  it('affiche seulement les 3 premières définitions si plus de 3 et un bouton "Afficher plus" pour tout voir', () => {
    const manyDefinitions = [
      { term: 'Test', genre: 'n.', definition: 'Def 1', example: 'Ex 1' },
      { term: 'Test', genre: 'n.', definition: 'Def 2', example: 'Ex 2' },
      { term: 'Test', genre: 'n.', definition: 'Def 3', example: 'Ex 3' },
      { term: 'Test', genre: 'n.', definition: 'Def 4', example: 'Ex 4' },
      { term: 'Test', genre: 'n.', definition: 'Def 5', example: 'Ex 5' },
    ];

    const { getByText, queryByText } = render(
      <DefinitionBlock definitions={manyDefinitions} />
    );

    // Should render the first 3
    expect(getByText(/Def 1/)).toBeTruthy();
    expect(getByText(/Def 2/)).toBeTruthy();
    expect(getByText(/Def 3/)).toBeTruthy();

    // Should NOT render Def 4 and Def 5 initially
    expect(queryByText(/Def 4/)).toBeNull();
    expect(queryByText(/Def 5/)).toBeNull();

    // Should display the "Afficher plus" button
    const expandBtn = getByText('Afficher plus (2 de plus)');
    expect(expandBtn).toBeTruthy();

    // Click to expand
    fireEvent.press(expandBtn);

    // Should now render all definitions
    expect(getByText(/Def 4/)).toBeTruthy();
    expect(getByText(/Def 5/)).toBeTruthy();

    // Button text should change to "Afficher moins"
    const collapseBtn = getByText('Afficher moins');
    expect(collapseBtn).toBeTruthy();

    // Click to collapse
    fireEvent.press(collapseBtn);

    // Should hide them again
    expect(queryByText(/Def 4/)).toBeNull();
    expect(queryByText(/Def 5/)).toBeNull();
  });
});
