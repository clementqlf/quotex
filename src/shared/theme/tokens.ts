import { Platform } from 'react-native';

export const spacing = {
    none: 0,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
} as const;

export const radii = {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
} as const;

export const iconSize = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    xxl: 48,
} as const;

export const animation = {
    duration: {
        fast: 150,
        normal: 300,
        slow: 500,
    },
} as const;

export const sizes = {
    xs: 32,
    sm: 40,
    md: 48,
    lg: 56,
    xl: 84,
    xxl: 110,
} as const;

export const typography = {
    fontFamily: {
        body: undefined as string | undefined,
        quote: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
        mono: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    fontSize: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        heading: 32,
    },
    lineHeight: {
        xs: 16,
        sm: 20,
        md: 24,
        lg: 28,
        xl: 32,
        heading: 40,
    },
    fontWeight: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
        extraBold: '800' as const,
    },
    letterSpacing: {
        xs: 0.5,
        sm: 1,
        md: 1.5,
    },
} as const;

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 1.0,
        elevation: 1,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
} as const;

export const tokens = {
    spacing,
    radii,
    sizes,
    iconSize,
    animation,
    typography,
    shadows,
} as const;

export type Tokens = typeof tokens;
export type Spacing = typeof spacing;
export type Radii = typeof radii;
export type Sizes = typeof sizes;
export type IconSize = typeof iconSize;
export type Animation = typeof animation;
export type Typography = typeof typography;
