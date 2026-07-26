import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';

interface AtmosphereCardProps {
    children?: React.ReactNode;
    style?: ViewStyle;
}

/**
 * Atmosphere Card component per Penumbra Design System.
 * Focal surface carrying atmosphere with hairline border and dark graphite background.
 */
export const AtmosphereCard: React.FC<AtmosphereCardProps> = ({ children, style }) => {
    const { colors } = useTheme();

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        overflow: 'hidden',
    },
});
