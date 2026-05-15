import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors, ThemeColors } from '../theme/theme';

type ThemeContextType = {
    theme: 'light' | 'dark';
    colors: ThemeColors;
    isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setTheme] = useState<'light' | 'dark'>(systemColorScheme === 'dark' ? 'dark' : 'light');

    useEffect(() => {
        setTheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    }, [systemColorScheme]);

    const themeColors = theme === 'dark' ? colors.dark : colors.light;

    const value = {
        theme,
        colors: themeColors,
        isDark: theme === 'dark',
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
