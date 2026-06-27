import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { colors, ThemeColors } from '../../shared/theme';
import { StorageService, STORAGE_KEYS } from '../../shared/api/StorageService';

export type ThemePreference = 'light' | 'dark' | 'auto';

type ThemeContextType = {
    theme: 'light' | 'dark';
    colors: ThemeColors;
    isDark: boolean;
    themePreference: ThemePreference;
    setThemePreference: (pref: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemColorScheme = useColorScheme();
    const [themePreference, setThemePreferenceState] = useState<ThemePreference>('auto');

    useEffect(() => {
        const loadThemePreference = async () => {
            const savedPref = await StorageService.getItem<ThemePreference>(STORAGE_KEYS.THEME_PREFERENCE);
            if (savedPref) {
                setThemePreferenceState(savedPref);
            }
        };
        loadThemePreference();
    }, []);

    const setThemePreference = async (pref: ThemePreference) => {
        setThemePreferenceState(pref);
        await StorageService.setItem(STORAGE_KEYS.THEME_PREFERENCE, pref);
    };

    const theme = useMemo<'light' | 'dark'>(() => {
        if (themePreference === 'auto') {
            return systemColorScheme === 'dark' ? 'dark' : 'light';
        }
        return themePreference;
    }, [themePreference, systemColorScheme]);

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
        themePreference,
        setThemePreference,
    }), [theme, themeColors, themePreference]);

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
