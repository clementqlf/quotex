import { formatRelativeDate, formatAbsoluteDate, formatFlexibleDate } from './dateUtils';

describe('dateUtils', () => {
  beforeAll(() => {
    // Freeze the system time at Saturday, June 27, 2026 20:00:00 UTC
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-27T20:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('formatRelativeDate', () => {
    it('should return an empty string for falsy/missing inputs', () => {
      expect(formatRelativeDate(null)).toBe('');
      expect(formatRelativeDate(undefined)).toBe('');
      expect(formatRelativeDate('')).toBe('');
    });

    it('should return an empty string for invalid date formats', () => {
      expect(formatRelativeDate('invalid-date-string')).toBe('');
      expect(formatRelativeDate(new Date('invalid'))).toBe('');
    });

    it('should format future dates in absolute fr-FR format', () => {
      // 10 minutes in the future
      const futureDate = new Date('2026-06-27T20:10:00Z');
      expect(formatRelativeDate(futureDate)).toBe('27 juin 2026');
    });

    it('should return "À l\'instant" for events less than 1 minute ago', () => {
      const thirtySecondsAgo = new Date('2026-06-27T19:59:30Z');
      expect(formatRelativeDate(thirtySecondsAgo)).toBe("À l'instant");
    });

    it('should format minutes correctly (singular and plural)', () => {
      const oneMinuteAgo = new Date('2026-06-27T19:59:00Z');
      expect(formatRelativeDate(oneMinuteAgo)).toBe('Il y a 1 minute');

      const fiveMinutesAgo = new Date('2026-06-27T19:55:00Z');
      expect(formatRelativeDate(fiveMinutesAgo)).toBe('Il y a 5 minutes');
    });

    it('should format hours correctly (singular and plural)', () => {
      const oneHourAgo = new Date('2026-06-27T19:00:00Z');
      expect(formatRelativeDate(oneHourAgo)).toBe('Il y a 1 heure');

      const fiveHoursAgo = new Date('2026-06-27T15:00:00Z');
      expect(formatRelativeDate(fiveHoursAgo)).toBe('Il y a 5 heures');
    });

    it('should format days correctly (singular and plural) within a week', () => {
      const oneDayAgo = new Date('2026-06-26T20:00:00Z');
      expect(formatRelativeDate(oneDayAgo)).toBe('Il y a 1 jour');

      const fourDaysAgo = new Date('2026-06-23T20:00:00Z');
      expect(formatRelativeDate(fourDaysAgo)).toBe('Il y a 4 jours');
    });

    it('should format to absolute fr-FR long date for events older than 7 days', () => {
      const eightDaysAgo = new Date('2026-06-19T20:00:00Z');
      expect(formatRelativeDate(eightDaysAgo)).toBe('19 juin 2026');
    });

    it('should catch errors and return empty string if date instantiation throws', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const throwingObj = {
        toString() {
          throw new Error('Throwing string conversion');
        },
      };
      expect(formatRelativeDate(throwingObj as any)).toBe('');
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('formatAbsoluteDate', () => {
    it('should return empty string for missing or invalid dates', () => {
      expect(formatAbsoluteDate(null)).toBe('');
      expect(formatAbsoluteDate(undefined)).toBe('');
      expect(formatAbsoluteDate('not-a-date')).toBe('');
    });

    it('should format a valid date/string to French format', () => {
      expect(formatAbsoluteDate('2026-06-20')).toBe('20 juin 2026');
      expect(formatAbsoluteDate(new Date('2026-12-25T12:00:00Z'))).toBe('25 décembre 2026');
    });

    it('should catch errors and return empty string if date instantiation throws', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const throwingObj = {
        toString() {
          throw new Error('Throwing string conversion');
        },
      };
      expect(formatAbsoluteDate(throwingObj as any)).toBe('');
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('formatFlexibleDate', () => {
    it('should return "Inconnu" for falsy/missing inputs', () => {
      expect(formatFlexibleDate(null)).toBe('Inconnu');
      expect(formatFlexibleDate(undefined)).toBe('Inconnu');
    });

    it('should return year as-is if string is 4 digits', () => {
      expect(formatFlexibleDate('1994')).toBe('1994');
    });

    it('should format YYYY-MM-DD ISO pattern to long French date format', () => {
      expect(formatFlexibleDate('1994-06-15')).toBe('15 juin 1994');
    });

    it('should attempt to parse other formats containing hyphens or slashes and format them', () => {
      expect(formatFlexibleDate('2020/10/12')).toBe('12 octobre 2020');
    });

    it('should return the original string as fallback if it is not a valid parsable date', () => {
      expect(formatFlexibleDate('Uncertain Date')).toBe('Uncertain Date');
    });
  });
});
