import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { Quote } from '@/src/shared/api/types';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { formatAbsoluteDate } from '@/src/shared/lib/dateUtils';
import { ThemeColors } from '@/src/shared/theme';
import { Plus, X } from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { BlockWrapper } from './BlockWrapper';
import { TabBar } from '../TabBar';

interface SavedQuotesBlockProps {
    quotes: Quote[];
    onQuotePress: (quote: Quote) => void;
    onRemove?: () => void;
    onAddQuote?: (pageY?: number) => void;
    showBookTitle?: boolean;
    title?: string;
    fallbackText?: string;
    publishedFallbackText?: string;
    savedFallbackText?: string;
    ownerId?: string;
}

const SavedQuotesBlockUI: React.FC<SavedQuotesBlockProps> = ({ 
    quotes, 
    onQuotePress, 
    onRemove, 
    onAddQuote, 
    showBookTitle, 
    title, 
    fallbackText, 
    publishedFallbackText,
    savedFallbackText,
    ownerId 
}) => {
    const { colors } = useTheme();
    const { user: currentUser } = useAuth();
    const styles = createStyles(colors);
    const [quoteSubFilter, setQuoteSubFilter] = useState<'ALL' | 'PUBLISHED' | 'SAVED'>('ALL');
    const [showAllQuotesModal, setShowAllQuotesModal] = useState(false);
    const [modalQuoteFilter, setModalQuoteFilter] = useState<'ALL' | 'PUBLISHED' | 'SAVED'>('ALL');

    const filteredQuotes = useMemo(() => {
        if (!quotes) return [];
        const targetOwnerId = ownerId || currentUser?.id;
        if (quoteSubFilter === 'PUBLISHED') {
            return quotes.filter(q => q.user?.id === targetOwnerId || !q.user);
        } else if (quoteSubFilter === 'SAVED') {
            return quotes.filter(q => q.user && q.user?.id !== targetOwnerId && q.isSaved);
        }
        return quotes;
    }, [quotes, quoteSubFilter, currentUser, ownerId]);

    const displayedQuotes = useMemo(() => {
        return filteredQuotes.slice(0, 5);
    }, [filteredQuotes]);

    const filteredModalQuotes = useMemo(() => {
        if (!quotes) return [];
        const targetOwnerId = ownerId || currentUser?.id;
        if (modalQuoteFilter === 'PUBLISHED') {
            return quotes.filter(q => q.user?.id === targetOwnerId || !q.user);
        } else if (modalQuoteFilter === 'SAVED') {
            return quotes.filter(q => q.user && q.user?.id !== targetOwnerId && q.isSaved);
        }
        return quotes;
    }, [quotes, modalQuoteFilter, currentUser, ownerId]);

    const rightElement = onAddQuote ? (
        <TouchableOpacity onPress={(e) => onAddQuote(e.nativeEvent.pageY)} style={{ padding: 4 }} testID="add-quote-block-btn">
            <Plus size={20} color={colors.primary} />
        </TouchableOpacity>
    ) : undefined;

    return (
        <BlockWrapper blockKey="savedQuotes" onRemove={onRemove} rightElement={rightElement} title={title}>
            <TabBar
                tabs={[
                    { id: 'ALL', label: 'Tout' },
                    { id: 'PUBLISHED', label: 'Publiées' },
                    { id: 'SAVED', label: 'Partagées' },
                ]}
                activeTab={quoteSubFilter}
                onTabPress={(tabId) => setQuoteSubFilter(tabId as any)}
                style={{ paddingHorizontal: 0, paddingBottom: 0, marginBottom: 16, backgroundColor: 'transparent' }}
            />

            {displayedQuotes.length === 0 ? (
                <Text style={styles.fallbackText}>
                    {quoteSubFilter === 'ALL' 
                        ? (fallbackText || (showBookTitle ? "Aucune citation sauvegardée pour cet auteur." : "Aucune citation sauvegardée pour ce livre."))
                        : quoteSubFilter === 'PUBLISHED'
                            ? (publishedFallbackText || "Aucune citation dans cette catégorie.")
                            : (savedFallbackText || "Aucune citation dans cette catégorie.")
                    }
                </Text>
            ) : (
                <View style={styles.savedQuotesList}>
                    {displayedQuotes.map((quote: Quote) => (
                        <TouchableOpacity
                            key={quote.id}
                            style={styles.savedQuoteCard}
                            activeOpacity={0.85}
                            onPress={() => onQuotePress(quote)}
                        >
                            <Text style={styles.savedQuoteText}>{quote.text}</Text>
                            <View style={styles.savedQuoteMeta}>
                                <View style={styles.savedQuoteAuthorContainer}>
                                    {showBookTitle ? (
                                        <Text numberOfLines={1} ellipsizeMode="clip" style={styles.savedQuoteAuthor}>
                                            {getBookTitle(quote.book)}
                                        </Text>
                                    ) : (
                                        <Text numberOfLines={1} ellipsizeMode="clip" style={styles.savedQuoteAuthor}>
                                            {getAuthorName(quote.author)}
                                        </Text>
                                    )}
                                    <View style={styles.fadeOverlayContainer} pointerEvents="none">
                                        <Svg width={24} height="100%">
                                            <Defs>
                                                <LinearGradient id={`fade-${quote.id}`} x1="0" y1="0" x2="1" y2="0">
                                                    <Stop offset="0" stopColor={colors.surfaceHighlight} stopOpacity="0" />
                                                    <Stop offset="1" stopColor={colors.surfaceHighlight} stopOpacity="1" />
                                                </LinearGradient>
                                            </Defs>
                                            <Rect width={24} height="100%" fill={`url(#fade-${quote.id})`} />
                                        </Svg>
                                    </View>
                                </View>
                                <Text style={styles.savedQuoteDate}>{formatAbsoluteDate(quote.savedAt || quote.date)}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {filteredQuotes.length > 5 && (
                <TouchableOpacity
                    style={styles.showAllButton}
                    onPress={() => {
                        setModalQuoteFilter(quoteSubFilter);
                        setShowAllQuotesModal(true);
                    }}
                >
                    <Text style={styles.showAllButtonText}>Afficher toutes les citations ({filteredQuotes.length})</Text>
                </TouchableOpacity>
            )}

            <Modal
                visible={showAllQuotesModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowAllQuotesModal(false)}
            >
                <View style={styles.quotesModalContainer}>
                    <View style={styles.quotesModalHeader}>
                        <TabBar
                            tabs={[
                                { id: 'ALL', label: 'Tout' },
                                { id: 'PUBLISHED', label: 'Publiées' },
                                { id: 'SAVED', label: 'Partagées' },
                            ]}
                            activeTab={modalQuoteFilter}
                            onTabPress={(tabId) => setModalQuoteFilter(tabId as any)}
                            style={{ flex: 1, paddingHorizontal: 0, paddingBottom: 0, borderBottomWidth: 0, backgroundColor: 'transparent' }}
                        />
                        <TouchableOpacity 
                            style={styles.modalCloseButton} 
                            onPress={() => setShowAllQuotesModal(false)}
                            accessible={true}
                            accessibilityLabel="Fermer"
                            accessibilityRole="button"
                        >
                            <X size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <FlashList
                        data={filteredModalQuotes}
                        keyExtractor={(item) => String(item.id)}
                        getItemType={() => 'quote'}
                        removeClippedSubviews={true}
                        contentContainerStyle={styles.quotesModalListContent}
                        renderItem={({ item }) => {
                            const isQuoteMine = item.user?.id === currentUser?.id || !item.user;
                            return (
                                <TouchableOpacity
                                    style={styles.quoteModalCard}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        setShowAllQuotesModal(false);
                                        onQuotePress(item);
                                    }}
                                >
                                    <Text style={styles.quoteModalText}>“ {item.text} ”</Text>
                                    <View style={styles.quoteModalMeta}>
                                        {showBookTitle ? (
                                            <Text style={styles.quoteModalBook}>{getBookTitle(item.book)}</Text>
                                        ) : (
                                            <Text style={styles.quoteModalBook}>{getAuthorName(item.author)}</Text>
                                        )}
                                        <Text style={styles.quoteModalUser}>
                                            Par {isQuoteMine ? 'Moi' : item.user?.name || `@${item.user?.username}`}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={styles.centered}>
                                <Text style={styles.emptyText}>Aucune citation trouvée.</Text>
                            </View>
                        }
                    />
                </View>
            </Modal>
        </BlockWrapper>
    );
};

export const SavedQuotesBlock = React.memo(SavedQuotesBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.ownerId === nextProps.ownerId &&
        prevProps.title === nextProps.title &&
        prevProps.fallbackText === nextProps.fallbackText &&
        prevProps.publishedFallbackText === nextProps.publishedFallbackText &&
        prevProps.savedFallbackText === nextProps.savedFallbackText &&
        prevProps.showBookTitle === nextProps.showBookTitle &&
        prevProps.quotes.length === nextProps.quotes.length &&
        prevProps.quotes.every((q, i) => q.id === nextProps.quotes[i].id)
    );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    fallbackText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 8,
        textAlign: 'center',
    },
    savedQuotesList: {
        gap: 12,
    },
    savedQuoteCard: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    savedQuoteText: {
        fontSize: 15,
        color: colors.text,
        lineHeight: 22,
        fontStyle: 'italic',
        marginBottom: 12,
        fontFamily: 'serif',
    },
    savedQuoteMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
    },
    savedQuoteAuthorContainer: {
        flex: 1,
        marginRight: 12,
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
    },
    savedQuoteAuthor: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
        flex: 1,
    },
    fadeOverlayContainer: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 24,
    },
    savedQuoteDate: {
        fontSize: 10,
        color: colors.textTertiary,
        flexShrink: 0,
    },
    tabsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 16,
        gap: 24,
    },
    tab: {
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: '600',
    },
    showAllButton: {
        marginTop: 16,
        padding: 12,
        backgroundColor: colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: 'center',
    },
    showAllButtonText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    quotesModalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    quotesModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginTop: Platform.OS === 'ios' ? 0 : 20,
    },
    quotesModalListContent: {
        padding: 16,
        paddingBottom: 32,
    },
    modalTabs: {
        flexDirection: 'row',
        gap: 16,
    },
    modalTabButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    modalTabButtonActive: {
        backgroundColor: colors.primaryLight,
        borderColor: colors.primary,
    },
    modalTabText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    modalTabTextActive: {
        color: colors.primary,
        fontWeight: '600',
    },
    modalCloseButton: {
        padding: 8,
    },
    quoteModalCard: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
    },
    quoteModalText: {
        fontSize: 15,
        color: colors.text,
        lineHeight: 22,
        fontStyle: 'italic',
        marginBottom: 12,
        fontFamily: 'serif',
    },
    quoteModalMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
    },
    quoteModalBook: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    quoteModalUser: {
        fontSize: 11,
        color: colors.textTertiary,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: colors.textTertiary,
        fontSize: 14,
        fontStyle: 'italic',
        textAlign: 'center',
    },
});
