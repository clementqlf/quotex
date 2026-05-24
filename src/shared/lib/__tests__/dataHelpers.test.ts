import { getBookTitle, getAuthorName, getStatusLabel, getStatusColor } from '../dataHelpers';

describe('dataHelpers', () => {
  describe('getBookTitle', () => {
    test('retourne "Livre inconnu" pour les valeurs falsy', () => {
      expect(getBookTitle(null)).toBe('Livre inconnu');
      expect(getBookTitle(undefined)).toBe('Livre inconnu');
      expect(getBookTitle('')).toBe('Livre inconnu');
    });

    test('retourne le titre si le livre est passé comme une chaîne de caractères', () => {
      expect(getBookTitle('Les Misérables')).toBe('Les Misérables');
    });

    test('retourne le titre si l’objet Book est passé', () => {
      expect(getBookTitle({ title: 'Le Comte de Monte-Cristo', id: 1, authors: [] })).toBe('Le Comte de Monte-Cristo');
    });

    test('retourne "Livre inconnu" si l’objet Book n’a pas de titre', () => {
      expect(getBookTitle({ id: 1, authors: [] } as any)).toBe('Livre inconnu');
    });
  });

  describe('getAuthorName', () => {
    test('retourne "Auteur inconnu" pour les valeurs falsy', () => {
      expect(getAuthorName(null)).toBe('Auteur inconnu');
      expect(getAuthorName(undefined)).toBe('Auteur inconnu');
      expect(getAuthorName('')).toBe('Auteur inconnu');
    });

    test('retourne le nom si l’auteur est passé sous forme de chaîne de caractères', () => {
      expect(getAuthorName('Victor Hugo')).toBe('Victor Hugo');
    });

    test('retourne le nom si l’objet Author est passé', () => {
      expect(getAuthorName({ name: 'Alexandre Dumas', id: 1, bio: '' })).toBe('Alexandre Dumas');
    });

    test('retourne "Auteur inconnu" si l’objet Author n’a pas de nom', () => {
      expect(getAuthorName({ id: 1, bio: '' } as any)).toBe('Auteur inconnu');
    });
  });

  describe('getStatusLabel', () => {
    test('retourne le libellé correct pour chaque statut connu', () => {
      expect(getStatusLabel('READ')).toBe('Lu');
      expect(getStatusLabel('TO_READ')).toBe('À lire');
      expect(getStatusLabel('READING')).toBe('En cours de lecture');
      expect(getStatusLabel('DROPPED')).toBe('Pas fini');
    });

    test('retourne la valeur brute ou vide si le statut est inconnu ou non fourni', () => {
      expect(getStatusLabel('UNKNOWN')).toBe('UNKNOWN');
      expect(getStatusLabel(undefined)).toBe('');
    });
  });

  describe('getStatusColor', () => {
    test('retourne la couleur correspondante pour chaque statut connu', () => {
      expect(getStatusColor('READ')).toBe('#10B981');
      expect(getStatusColor('TO_READ')).toBe('#3B82F6');
      expect(getStatusColor('READING')).toBe('#F59E0B');
      expect(getStatusColor('DROPPED')).toBe('#EF4444');
    });

    test('retourne la couleur grise par défaut pour les statuts inconnus ou vides', () => {
      expect(getStatusColor('UNKNOWN')).toBe('#9CA3AF');
      expect(getStatusColor(undefined)).toBe('#9CA3AF');
    });
  });
});
