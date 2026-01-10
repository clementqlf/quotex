import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { BLOCK_CONFIGS, BlockKey } from '../../src/config/blocks';

interface BlockWrapperProps {
    blockKey: BlockKey;
    onRemove?: () => void;
    children: React.ReactNode;
    title?: string; // Optional override
    fullWidth?: boolean; // If content handles its own padding/layout
    rightElement?: React.ReactNode;
}

export const BlockWrapper: React.FC<BlockWrapperProps> = ({
    blockKey,
    onRemove,
    children,
    title,
    fullWidth = false,
    rightElement
}) => {
    const config = BLOCK_CONFIGS[blockKey];
    const Icon = config?.icon || (() => null);
    const displayTitle = title || config?.label || 'Block';

    return (
        <View style={fullWidth ? styles.wrapperFull : styles.section}>
            {!fullWidth && (
                <View style={styles.sectionHeader}>
                    <View style={styles.headerLeft}>
                        <Icon size={16} color="#20B8CD" />
                        <Text style={styles.sectionTitle}>{displayTitle}</Text>
                    </View>
                    {rightElement}
                </View>
            )}

            {children}

            {onRemove && (
                <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
                    <X size={14} color="#EF4444" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapperFull: {
        marginBottom: 10,
    },
    section: {
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#2A2A2A',
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
        color: '#FFFFFF',
    },
    removeButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
        padding: 4,
    }
});
