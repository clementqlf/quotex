import { z } from 'zod';

/**
 * Regex patterns for ISBN validation
 */
export const ISBN_13_REGEX = /^(97[89])\d{10}$/;
export const ISBN_10_REGEX = /^\d{9}[\dxX]$/i;

/**
 * Combined regex that matches valid ISBN-10 or ISBN-13
 * Note: This is stricter than just \d{10}|\d{13} - it validates the structure
 */
export const ISBN_REGEX = /^(?:97[89]\d{10}|\d{9}[\dxX])$/i;

/**
 * Validate an ISBN string (with or without separators)
 * @param isbn - The ISBN string to validate
 * @returns true if valid ISBN-10 or ISBN-13
 */
export const validateIsbn = (isbn: string): boolean => {
  const cleaned = isbn.replace(/[-\s]/g, '');
  return ISBN_REGEX.test(cleaned);
};

/**
 * Zod schema for ISBN validation
 * Use this in API schemas to ensure valid ISBN format
 */
export const IsbnSchema = z.string().refine(
  (value) => validateIsbn(value),
  { message: 'Invalid ISBN format. Must be valid ISBN-10 or ISBN-13' }
);

/**
 * Extract ISBN from text using pattern matching
 * Prioritizes ISBN-13 (978/979 prefix), falls back to ISBN-10
 * @param text - Text to search for ISBN
 * @returns Extracted ISBN string or null if not found
 */
export function extractIsbn(text: string): string | null {
  'worklet';
  const cleanText = text.replace(/\n/g, ' ');
  const candidates = cleanText.match(/(?:[0-9xX][-\s]*){9,17}/g) || [];
  
  let found10: string | null = null;
  
  for (const cand of candidates) {
    const cleaned = cand.replace(/[-\s]/g, '');
    if (cleaned.length === 13 && ISBN_13_REGEX.test(cleaned)) {
      return cleaned;
    }
    if (cleaned.length === 10 && ISBN_10_REGEX.test(cleaned)) {
      if (!found10) found10 = cleaned;
    }
  }
  
  const digitsOnly = cleanText.replace(/[^0-9xX]/g, '');
  const fallbackMatch = /(97[89]\d{10})/.exec(digitsOnly);
  if (fallbackMatch) {
    return fallbackMatch[1];
  }
  
  const fallbackMatch10 = /(\b\d{9}[\dxX]\b)/i.exec(digitsOnly);
  if (fallbackMatch10) {
    return fallbackMatch10[1];
  }
  
  return found10;
}
