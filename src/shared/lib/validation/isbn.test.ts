import { validateIsbn, IsbnSchema, extractIsbn, ISBN_13_REGEX, ISBN_10_REGEX } from './isbn';

describe('isbn validation & extraction', () => {
  describe('Regex Pattern Constants', () => {
    it('should validate exact ISBN-13 formats without separators', () => {
      expect(ISBN_13_REGEX.test('9782070368976')).toBe(true);
      expect(ISBN_13_REGEX.test('9791037502434')).toBe(true);
      // Malformed ISBN-13
      expect(ISBN_13_REGEX.test('978-2070368976')).toBe(false); // contains hyphen
      expect(ISBN_13_REGEX.test('978207036897')).toBe(false); // too short
      expect(ISBN_13_REGEX.test('97820703689767')).toBe(false); // too long
      expect(ISBN_13_REGEX.test('8782070368976')).toBe(false); // wrong prefix (must be 978/979)
    });

    it('should validate exact ISBN-10 formats without separators', () => {
      expect(ISBN_10_REGEX.test('207036897X')).toBe(true);
      expect(ISBN_10_REGEX.test('207036897x')).toBe(true);
      expect(ISBN_10_REGEX.test('0306406152')).toBe(true);
      // Malformed ISBN-10
      expect(ISBN_10_REGEX.test('2-07036897X')).toBe(false); // contains hyphen
      expect(ISBN_10_REGEX.test('207036897')).toBe(false); // too short
      expect(ISBN_10_REGEX.test('207036897XX')).toBe(false); // too long
    });
  });

  describe('validateIsbn', () => {
    it('should return true for valid ISBN-13 with hyphens and spaces', () => {
      expect(validateIsbn('978-2-07-036897-6')).toBe(true);
      expect(validateIsbn('979 10 375 0243 4')).toBe(true);
    });

    it('should return true for valid ISBN-10 with hyphens and spaces', () => {
      expect(validateIsbn('2-07-036897-X')).toBe(true);
      expect(validateIsbn('0 306 40615 2')).toBe(true);
    });

    it('should return false for empty or invalid strings', () => {
      expect(validateIsbn('')).toBe(false);
      expect(validateIsbn('abc')).toBe(false);
      expect(validateIsbn('1234567890')).toBe(true); // matches length 10 digits
      expect(validateIsbn('1234567890123')).toBe(false); // invalid ISBN-13 format (no 978/979 prefix)
    });
  });

  describe('IsbnSchema (Zod)', () => {
    it('should successfully parse valid ISBNs', () => {
      const result = IsbnSchema.safeParse('978-2-07-036897-6');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('978-2-07-036897-6');
      }
    });

    it('should fail to parse invalid ISBNs and provide clear error message', () => {
      const result = IsbnSchema.safeParse('invalid-isbn-format');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid ISBN format. Must be valid ISBN-10 or ISBN-13');
      }
    });
  });

  describe('extractIsbn', () => {
    it('should extract ISBN-13 from text containing hyphens and spaces', () => {
      const text = 'Voici un livre incroyable à lire absolument : ISBN: 978-2-07-036897-6, édité en France.';
      expect(extractIsbn(text)).toBe('9782070368976');
    });

    it('should extract ISBN-10 when ISBN-13 is not present', () => {
      const text = 'Référence de l’ouvrage: 2-07-036897-X. Bonne lecture !';
      expect(extractIsbn(text)).toBe('207036897X');
    });

    it('should prioritize ISBN-13 over ISBN-10 if both are present in candidates', () => {
      const text = 'Consultez 2-07-036897-X ou l’édition plus récente 978-2-07-036897-6.';
      expect(extractIsbn(text)).toBe('9782070368976');
    });

    it('should clean and handle multiline texts', () => {
      const text = 'ISBN\n978-2-07\n-036897-6';
      expect(extractIsbn(text)).toBe('9782070368976');
    });

    it('should fall back to raw digits-only matching for ISBN-13', () => {
      const text = 'Un texte avec des chiffres collés 9782070368976 sans autre séparateur.';
      expect(extractIsbn(text)).toBe('9782070368976');
    });

    it('should fall back to raw digits-only matching for ISBN-13 when letters separate the digits in raw text', () => {
      const text = '9 a 7 a 8 a 2 a 0 a 7 a 0 a 3 a 6 a 8 a 9 a 7 a 6';
      expect(extractIsbn(text)).toBe('9782070368976');
    });

    it('should fall back to raw digits-only matching for ISBN-10 with word boundaries', () => {
      const text = 'Livre code 207036897X au milieu de la phrase.';
      expect(extractIsbn(text)).toBe('207036897X');
    });

    it('should fall back to raw digits-only matching for ISBN-10 when letters separate the digits in raw text', () => {
      const text = '2 a 0 a 7 a 0 a 3 a 6 a 8 a 9 a 7 a X';
      expect(extractIsbn(text)).toBe('207036897X');
    });

    it('should return null if no matching pattern is found', () => {
      expect(extractIsbn('Pas d’isbn ici.')).toBe(null);
      expect(extractIsbn('')).toBe(null);
      expect(extractIsbn('Chiffres aléatoires 123 456 789.')).toBe(null);
    });
  });
});
