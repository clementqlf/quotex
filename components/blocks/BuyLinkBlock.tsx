import React from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, StyleSheet } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { Book } from '../../types';

interface BuyLinkBlockProps {
    book: Book;
    onRemove?: () => void;
}

export const BuyLinkBlock: React.FC<BuyLinkBlockProps> = ({ book, onRemove }) => {
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
                            <ExternalLink size={12} color="#6B7280" />
                        </View>
                        <Text style={styles.buyLinkPrice}>{link.price}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </BlockWrapper>
    );
};

const styles = StyleSheet.create({
    fallbackText: {
        color: '#9CA3AF',
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
        backgroundColor: '#2A2A2A',
        padding: 12,
        borderRadius: 8,
    },
    buyLinkInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    buyLinkStore: {
        color: '#E5E7EB',
        fontWeight: '500',
        fontSize: 14,
    },
    buyLinkPrice: {
        color: '#20B8CD',
        fontWeight: '700',
        fontSize: 14,
    },
});
