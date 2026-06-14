import { useTheme } from '@/src/app/providers/ThemeContext';
import { BLOCK_CONFIGS, BlockKey } from '@/src/shared/config/blocks';
import { ThemeColors } from '@/src/shared/theme';
import { X } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BlockWrapperProps {
    blockKey: BlockKey;
    onRemove?: () => void;
    children: React.ReactNode;
    title?: string; // Optional override
    fullWidth?: boolean; // If content handles its own padding/layout
    rightElement?: React.ReactNode;
}

const FallbackIcon = () => null;

export const BlockWrapper: React.FC<BlockWrapperProps> = ({
    blockKey,
    onRemove,
    children,
    title,
    fullWidth = false,
    rightElement
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const config = BLOCK_CONFIGS[blockKey];
    const Icon = config?.icon || FallbackIcon;
    const displayTitle = title || config?.label || 'Block';

    return (
        <View style={fullWidth ? styles.wrapperFull : styles.section}>
            {!fullWidth && (
                <View style={styles.sectionHeader}>
                    <View style={styles.headerLeft}>
                        <Icon size={16} color={colors.primary} />
                        <Text style={styles.sectionTitle}>{displayTitle}</Text>
                    </View>
                    {rightElement}
                </View>
            )}

            {children}

            {onRemove && (
                <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
                    <X size={16} color={colors.textTertiary} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    wrapperFull: {
        marginBottom: 10,
    },
    section: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        position: 'relative'
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        justifyContent: 'space-between'
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    removeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 14,
        padding: 6,
        zIndex: 10,
    }
});
