import { useTheme } from '@/src/app/providers/ThemeContext';
import { BLOCK_CONFIGS, BlockKey } from '@/src/shared/config/blocks';
import { Card } from '../Card';
import { IconButton } from '../IconButton';
import { X } from 'lucide-react-native';
import React from 'react';
import { Alert, Keyboard, StyleSheet, Text, View } from 'react-native';
import { tokens as defaultTokens } from '@/src/shared/theme';

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
    const { colors, tokens = defaultTokens } = useTheme();
    const config = BLOCK_CONFIGS[blockKey];
    const Icon = config?.icon || FallbackIcon;
    const displayTitle = title || config?.label || 'Block';

    const handleRemove = () => {
        if (!onRemove) return;
        Alert.alert(
            'Supprimer le bloc',
            `Voulez-vous vraiment supprimer le bloc « ${displayTitle} » ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: onRemove }
            ]
        );
    };

    // Mode fullWidth : pas de carte, juste un conteneur simple avec marge basse
    if (fullWidth) {
        return (
            <View
                style={{ marginBottom: 10 }}
                onTouchStart={blockKey !== 'notes' ? Keyboard.dismiss : undefined}
            >
                {children}
            </View>
        );
    }

    return (
        <Card
            variant="outlined"
            padding="none"
            style={{ marginBottom: 10, position: 'relative' }}
            // @ts-ignore – onTouchStart is valid on View, Card wraps a View
            onTouchStart={blockKey !== 'notes' ? Keyboard.dismiss : undefined}
        >
            {/* Padding interne géré manuellement pour garder le bouton X en absolu */}
            <View style={{ padding: tokens.spacing.md }}>
                {/* En-tête : icône + titre + élément optionnel à droite */}
                <View style={styles.sectionHeader}>
                    <View style={styles.headerLeft}>
                        <Icon size={16} color={colors.primary} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                            {displayTitle}
                        </Text>
                    </View>
                    {rightElement}
                </View>

                {children}
            </View>

            {/* Bouton de suppression — positionné en absolu sur la carte */}
            {onRemove && (
                <IconButton
                    icon={<X size={16} color={colors.textTertiary} />}
                    variant="filled"
                    size="sm"
                    onPress={handleRemove}
                    enableHaptics={false}
                    style={{
                        position: 'absolute',
                        top: tokens.spacing.sm + 2,
                        right: tokens.spacing.sm + 2,
                        zIndex: 10,
                    }}
                    accessibilityLabel={`Supprimer le bloc ${displayTitle}`}
                />
            )}
        </Card>
    );
};

const styles = StyleSheet.create({
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        justifyContent: 'space-between',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontFamily: defaultTokens.typography.fontFamily.display,
        fontWeight: '700',
    },
});
