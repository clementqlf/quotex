import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, StyleSheet } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { Book } from '@/types';
import { useTheme } from '@/src/contexts/ThemeContext';
import { ThemeColors } from '@/src/theme/theme';

interface BuyLinkBlockProps {
    book: Book;
    onRemove?: () => void;
}

export const BuyLinkBlock: React.FC<BuyLinkBlockProps> = ({ book, onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const hasLinks = book.buyLinks && book.buyLinks.length > 0;

    if (!hasLinks) {
        return (
            <BlockWrapper blockKey="buy" onRemove={onRemove}>
                <Text style={styles.fallbackText}>
                    Aucun lien d'achat disponible.
                </Text>
            </BlockWrapper>
        );
    }

    return (
        <BlockWrapper blockKey="buy" onRemove={onRemove}>
            <View style={styles.buyLinksList}>
                {book.buyLinks!.map((link, idx) => (
                    <TouchableOpacity
                        key={idx}
                        style={styles.buyLinkItem}
                        onPress={() => {
                            Linking.openURL(link.url).catch(err => Alert.alert("Erreur", "Impossible d'ouvrir le lien"));
                        }}
                    >
                        <View style={styles.buyLinkInfo}>
                            <Text style={styles.buyLinkStore}>{link.store}</Text>
                            <ExternalLink size={12} color={colors.textTertiary} />
                        </View>
                        <Text style={styles.buyLinkPrice}>{link.price}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </BlockWrapper>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    fallbackText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 8
    },
    buyLinksList: {
        gap: 8,
    },
    buyLinkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surfaceHighlight,
        padding: 12,
        borderRadius: 8,
    },
    buyLinkInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    buyLinkStore: {
        color: colors.text,
        fontWeight: '500',
        fontSize: 14,
    },
    buyLinkPrice: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: 14,
    },
});
