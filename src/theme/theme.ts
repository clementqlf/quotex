const commonColors = {
    primary: '#20B8CD',
    primaryLight: 'rgba(32, 184, 205, 0.1)',
    accent: '#3B82F6',
    accentLight: 'rgba(59, 130, 246, 0.1)',
    success: '#10B981',
    successLight: 'rgba(16, 185, 129, 0.1)',
    warning: '#EC4899',
    warningLight: 'rgba(236, 72, 153, 0.1)',
    iconSecondary: '#9CA3AF',
};

export const colors = {
    dark: {
        ...commonColors,
        background: '#0F0F0F',
        surface: '#1A1A1A',
        surfaceHighlight: '#2A2A2A',
        text: '#FFFFFF',
        textSecondary: '#9CA3AF', // Gray-400
        textTertiary: '#6B7280', // Gray-500
        border: '#1F1F1F',
        icon: '#FFFFFF',
        inputBackground: '#1A1A1A',
        inputText: '#FFFFFF',
        inputPlaceholder: '#6B7280',
        cardBackground: '#1A1A1A',
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
    }
};

export type ThemeColors = typeof colors.dark;
