export const formatRelativeDate = (dateString: string | Date | undefined): string => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // If future date (shouldn't happen usually but good for robustness), return standard format
    if (diffInSeconds < 0) {
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
    } else {
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
};
