import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { Quote } from '@/src/shared/api/types';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { formatAbsoluteDate } from '@/src/shared/lib/dateUtils';
import { ThemeColors } from '@/src/shared/theme';
import { Plus } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlockWrapper } from './BlockWrapper';

interface SavedQuotesBlockProps {
    quotes: Quote[];
    onQuotePress: (quote: Quote) => void;
    onRemove?: () => void;
    onAddQuote?: (pageY?: number) => void;
    showBookTitle?: boolean;
    title?: string;
    fallbackText?: string;
    ownerId?: string;
}

const SavedQuotesBlockUI: React.FC<SavedQuotesBlockProps> = ({ quotes, onQuotePress, onRemove, onAddQuote, showBookTitle, title, fallbackText, ownerId }) => {
    const { colors } = useTheme();
    const { user: currentUser } = useAuth();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [quoteSubFilter, setQuoteSubFilter] = useState<'ALL' | 'PUBLISHED' | 'SAVED'>('ALL');

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

    const rightElement = onAddQuote ? (
        <TouchableOpacity onPress={(e) => onAddQuote(e.nativeEvent.pageY)} style={{ padding: 4 }} testID="add-quote-block-btn">
            <Plus size={20} color={colors.primary} />
        </TouchableOpacity>
    ) : undefined;

    return (
        <BlockWrapper blockKey="savedQuotes" onRemove={onRemove} rightElement={rightElement} title={title}>
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    onPress={() => setQuoteSubFilter('ALL')}
                    style={[styles.tab, quoteSubFilter === 'ALL' && styles.activeTab]}
                >
                    <Text style={[styles.tabText, quoteSubFilter === 'ALL' && styles.activeTabText]}>
                        Tout
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setQuoteSubFilter('PUBLISHED')}
                    style={[styles.tab, quoteSubFilter === 'PUBLISHED' && styles.activeTab]}
                >
                    <Text style={[styles.tabText, quoteSubFilter === 'PUBLISHED' && styles.activeTabText]}>
                        Publiés
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setQuoteSubFilter('SAVED')}
                    style={[styles.tab, quoteSubFilter === 'SAVED' && styles.activeTab]}
                >
                    <Text style={[styles.tabText, quoteSubFilter === 'SAVED' && styles.activeTabText]}>
                        Enregistré
                    </Text>
                </TouchableOpacity>
            </View>

            {filteredQuotes.length === 0 ? (
                <Text style={styles.fallbackText}>
                    {quoteSubFilter === 'ALL' 
                        ? (fallbackText || (showBookTitle ? "Aucune citation sauvegardée pour cet auteur." : "Aucune citation sauvegardée pour ce livre."))
                        : "Aucune citation dans cette catégorie."
                    }
                </Text>
            ) : (
                <View style={styles.savedQuotesList}>
                    {filteredQuotes.map(quote => (
                        <TouchableOpacity
                            key={quote.id}
                            style={styles.savedQuoteCard}
                            activeOpacity={0.85}
                            onPress={() => onQuotePress(quote)}
                        >
                            <Text style={styles.savedQuoteText}>{quote.text}</Text>
                            <View style={styles.savedQuoteMeta}>
                                {showBookTitle ? (
                                    <Text style={styles.savedQuoteAuthor}>{getBookTitle(quote.book)}</Text>
                                ) : (
                                    <Text style={styles.savedQuoteAuthor}>{getAuthorName(quote.author)}</Text>
                                )}
                                <Text style={styles.savedQuoteDate}>{formatAbsoluteDate(quote.savedAt || quote.date)}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </BlockWrapper>
    );
};

export const SavedQuotesBlock = React.memo(SavedQuotesBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.ownerId === nextProps.ownerId &&
        prevProps.title === nextProps.title &&
        prevProps.fallbackText === nextProps.fallbackText &&
        prevProps.showBookTitle === nextProps.showBookTitle &&
        prevProps.quotes.length === nextProps.quotes.length &&
        prevProps.quotes.every((q, i) => q.id === nextProps.quotes[i].id)
    );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    fallbackText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 8
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
    savedQuoteAuthor: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    savedQuoteDate: {
        fontSize: 10,
        color: colors.textTertiary,
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
});
