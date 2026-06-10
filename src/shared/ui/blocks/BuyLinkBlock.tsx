import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, StyleSheet, Modal, ScrollView, Platform } from 'react-native';
import { ExternalLink, ShoppingCart, ChevronRight, X } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { Book } from '@/src/shared/api/types';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { BUY_STORES } from '@/src/shared/config/stores';
import { SafeAreaView } from 'react-native-safe-area-context';

interface BuyLinkBlockProps {
    book: Book;
    onRemove?: () => void;
}

const BuyLinkBlockUI: React.FC<BuyLinkBlockProps> = ({ book, onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Sanitize function for URL safety
    const sanitizeForUrl = (str: string): string => {
        return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[^\p{L}\p{N}\s\-']/gu, "") // Keep only letters, numbers, spaces, hyphens, apostrophes
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 200); // Limit length for URL safety
    };

    const allLinks = useMemo(() => {
        if (book.buyLinks && book.buyLinks.length > 0) {
            return book.buyLinks;
        }
        
        const title = typeof book.title === 'string' && book.title.trim()
            ? book.title.trim()
            : 'Livre sans titre';
        const authorName = typeof book.author === 'string'
            ? book.author.trim()
            : (book.author?.name ? String(book.author.name).trim() : 'Auteur inconnu');
        
        if (!title || !authorName) {
            return BUY_STORES.map(store => ({
                store: store.name,
                url: store.generateUrl('Livre inconnu'),
                price: store.priceLabel
            }));
        }
        
        // Use improved sanitization
        const cleanTitle = sanitizeForUrl(title) || 'Livre';
        const cleanAuthor = sanitizeForUrl(authorName) || 'Auteur';
        
        // Generate safe query text
        const queryText = `${cleanTitle} ${cleanAuthor}`.trim();
        const query = encodeURIComponent(queryText);
        
        return BUY_STORES.map(store => ({
            store: store.name,
            url: store.generateUrl(query),
            price: store.priceLabel
        }));
    }, [book]);

    const initialLinks = allLinks.slice(0, 2);
    const hasMore = allLinks.length > 2;

    const renderLink = (link: any, idx: number, isCompact = false) => {
        const safeUrl = typeof link.url === 'string' && link.url.startsWith('http')
            ? link.url
            : 'https://quotex.app';

        return (
            <TouchableOpacity
                key={idx}
                style={[styles.buyLinkItem, isCompact && styles.buyLinkItemCompact]}
                onPress={() => {
                    Linking.canOpenURL(safeUrl).then(supported => {
                        if (supported) {
                            Linking.openURL(safeUrl).catch(err => {
                                console.error('[BuyLinkBlock] Failed to open URL:', safeUrl, err);
                                Alert.alert("Erreur", "Impossible d'ouvrir ce lien.");
                            });
                        } else {
                            Alert.alert("Erreur", "Aucune application ne peut ouvrir ce type de lien.");
                        }
                    });
                }}
            >
            <View style={styles.buyLinkInfo}>
                <View style={[styles.storeIcon, { backgroundColor: colors.primary + '15' }]}>
                    <ShoppingCart size={14} color={colors.primary} />
                </View>
                <View>
                    <Text style={styles.buyLinkStore}>{link.store}</Text>
                    {!isCompact && (
                        <View style={styles.externalRow}>
                            <Text style={styles.externalText}>Ouvrir le site</Text>
                            <ExternalLink size={10} color={colors.textTertiary} />
                        </View>
                    )}
                </View>
            </View>
            <View style={styles.priceContainer}>
                <Text style={styles.buyLinkPrice}>{link.price}</Text>
                {isCompact && <ExternalLink size={10} color="#FFFFFF" style={{ marginLeft: 4 }} />}
            </View>
        </TouchableOpacity>
    );
};

    return (
        <BlockWrapper blockKey="buy" onRemove={onRemove}>
            <View style={styles.buyLinksList}>
                {initialLinks.map((link, idx) => renderLink(link, idx))}
                
                {hasMore && (
                    <TouchableOpacity 
                        style={styles.showMoreButton}
                        onPress={() => setIsModalVisible(true)}
                    >
                        <Text style={styles.showMoreText}>Voir toutes les options ({allLinks.length})</Text>
                        <ChevronRight size={16} color={colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            <Modal
                visible={isModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Où acheter ce livre ?</Text>
                            <TouchableOpacity 
                                style={styles.closeButton}
                                onPress={() => setIsModalVisible(false)}
                            >
                                <X size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView 
                            contentContainerStyle={styles.modalContent}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.modalSubtitle}>Sélectionnez une boutique pour voir le prix et la disponibilité :</Text>
                            <View style={styles.modalGrid}>
                                {allLinks.map((link, idx) => renderLink(link, idx, true))}
                            </View>
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </Modal>
        </BlockWrapper>
    );
};

export const BuyLinkBlock = React.memo(BuyLinkBlockUI, (prevProps, nextProps) => {
    return prevProps.book?.isbn === nextProps.book?.isbn &&
           prevProps.book?.title === nextProps.book?.title;
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    buyLinksList: {
        gap: 10,
    },
    buyLinkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surfaceHighlight,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border + '30',
    },
    buyLinkItemCompact: {
        paddingVertical: 10,
    },
    buyLinkInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    storeIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyLinkStore: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 14,
    },
    externalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    externalText: {
        fontSize: 11,
        color: colors.textTertiary,
    },
    priceContainer: {
        backgroundColor: colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    buyLinkPrice: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 12,
    },
    showMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        marginTop: 4,
        gap: 4,
    },
    showMoreText: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 13,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border + '30',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContent: {
        padding: 20,
        paddingBottom: 40,
    },
    modalSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 20,
        lineHeight: 20,
    },
    modalGrid: {
        gap: 12,
    },
});


