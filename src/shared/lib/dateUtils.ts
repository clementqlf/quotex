export const formatRelativeDate = (dateString: string | Date | undefined | null): string => {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';

        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        // If future date or somehow NaN, return standard format
        if (isNaN(diffInSeconds) || diffInSeconds < 0) {
            return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        const minutes = Math.floor(diffInSeconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) {
            return 'À l\'instant';
        } else if (minutes < 60) {
            return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
        } else if (hours < 24) {
            return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
        } else if (days < 7) {
            return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
        } else {
            return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        }
    } catch (e) {
        console.error('[dateUtils] Error formatting date:', e);
        return '';
    }
};

export const formatAbsoluteDate = (dateString: string | Date | undefined | null): string => {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
        console.error('[dateUtils] Error formatting absolute date:', e);
        return '';
    }
};

/**
 * Format a date string flexibly, handling various formats:
 * - Year only (YYYY) → returns as-is
 * - ISO format (YYYY-MM-DD) → formats to fr-FR long date
 * - Other date strings → attempts to parse and format
 * - Invalid/empty → returns 'Inconnu'
 */
export const formatFlexibleDate = (dateStr?: string | null): string => {
  if (!dateStr) return 'Inconnu';
  if (/^\d{4}$/.test(dateStr)) return dateStr;
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime()) && (dateStr.includes('-') || dateStr.includes('/'))) {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return dateStr;
};
