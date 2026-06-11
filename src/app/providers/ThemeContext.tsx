import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors, ThemeColors } from '../../shared/theme';

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

    // ✅ Memoization de themeColors pour éviter les recalculs inutiles
    const themeColors = useMemo(() => 
        theme === 'dark' ? colors.dark : colors.light, 
        [theme]
    );

    // ✅ Memoization de value pour éviter les re-renders en cascade
    const value = useMemo(() => ({
        theme,
        colors: themeColors,
        isDark: theme === 'dark',
    }), [theme, themeColors]);

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
