import { formatRelativeDate } from '../dateUtils';

describe('formatRelativeDate', () => {
  beforeAll(() => {
    // Figer la date actuelle pour s'assurer que les calculs de différence de temps sont déterministes.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-24T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('retourne une chaîne vide si la date est indéfinie ou invalide', () => {
    expect(formatRelativeDate(null)).toBe('');
    expect(formatRelativeDate(undefined)).toBe('');
    expect(formatRelativeDate('date-invalide')).toBe('');
  });

  test('retourne "À l\'instant" si la date est il y a moins d\'une minute', () => {
    const rawDate = new Date('2026-05-24T11:59:45.000Z'); // 15 secondes avant
    expect(formatRelativeDate(rawDate)).toBe("À l'instant");
  });

  test('retourne "Il y a X minute(s)" si inférieur à une heure', () => {
    const oneMinAgo = new Date('2026-05-24T11:58:30.000Z'); // 1 min 30s
    const fifteenMinAgo = new Date('2026-05-24T11:45:00.000Z'); // 15 mins

    expect(formatRelativeDate(oneMinAgo)).toBe('Il y a 1 minute');
    expect(formatRelativeDate(fifteenMinAgo)).toBe('Il y a 15 minutes');
  });

  test('retourne "Il y a X heure(s)" si inférieur à 24 heures', () => {
    const oneHourAgo = new Date('2026-05-24T11:00:00.000Z'); // 1 heure
    const fiveHoursAgo = new Date('2026-05-24T07:00:00.000Z'); // 5 heures

    expect(formatRelativeDate(oneHourAgo)).toBe('Il y a 1 heure');
    expect(formatRelativeDate(fiveHoursAgo)).toBe('Il y a 5 heures');
  });

  test('retourne "Il y a X jour(s)" si inférieur à 7 jours', () => {
    const oneDayAgo = new Date('2026-05-23T12:00:00.000Z'); // 1 jour
    const fourDaysAgo = new Date('2026-05-20T12:00:00.000Z'); // 4 jours

    expect(formatRelativeDate(oneDayAgo)).toBe('Il y a 1 jour');
    expect(formatRelativeDate(fourDaysAgo)).toBe('Il y a 4 jours');
  });

  test('retourne la date formatée si supérieure à 7 jours ou dans le futur', () => {
    const longAgo = new Date('2026-05-10T12:00:00.000Z'); // 14 jours avant
    const futureDate = new Date('2026-05-25T12:00:00.000Z'); // Futur

    expect(formatRelativeDate(longAgo)).toContain('mai 2026');
    expect(formatRelativeDate(futureDate)).toContain('mai 2026');
  });
});
