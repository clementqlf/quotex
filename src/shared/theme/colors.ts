const commonColors = {
    primary: '#20B8CD',
    primaryLight: 'rgba(32, 184, 205, 0.1)',
    accent: '#3B82F6',
    accentLight: 'rgba(59, 130, 246, 0.1)',
    success: '#10B981',
    successLight: 'rgba(16, 185, 129, 0.1)',
    warning: '#F59E0B',
    warningLight: 'rgba(245, 158, 11, 0.1)',
    error: '#EF4444',
    errorLight: 'rgba(239, 68, 68, 0.1)',
    iconSecondary: '#9CA3AF',
};

export const colors = {
    dark: {
        ...commonColors,
        background: '#08080a', // Obsidian
        surface: '#101013', // Graphite (Atmosphere cards & primary surfaces)
        surfaceHighlight: '#17171c', // Slate (Sidebars & inputs)
        text: '#e8e5dc', // Beacon
        textSecondary: '#a0a0a5',
        textTertiary: '#6B7280',
        border: '#23232a', // Hairline
        icon: '#e8e5dc',
        inputBackground: '#17171c',
        inputText: '#e8e5dc',
        inputPlaceholder: '#a0a0a5',
        cardBackground: '#101013',
        buttonText: '#08080a',
        backdrop: 'rgba(8, 8, 10, 0.75)',
        accent: '#e8e5dc', // Beacon accent
    },

    light: {
        ...commonColors,
        background: '#F9FAFB', // Gray-50
        surface: '#FFFFFF',
        surfaceHighlight: '#F3F4F6', // Gray-100
        text: '#111827', // Gray-900
        textSecondary: '#4B5563', // Gray-600
        textTertiary: '#6B7280', // Gray-500
        border: '#E5E7EB', // Gray-200
        icon: '#111827',
        inputBackground: '#F3F4F6',
        inputText: '#111827',
        inputPlaceholder: '#9CA3AF',
        cardBackground: '#FFFFFF',
        buttonText: '#FFFFFF',
        backdrop: 'rgba(0, 0, 0, 0.45)',
    }
};

export type ThemeColors = typeof colors.dark;
