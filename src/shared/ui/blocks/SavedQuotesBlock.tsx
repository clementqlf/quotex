import { useTheme } from '@/src/app/providers/ThemeContext';
import { Quote } from '@/src/shared/api/types';
import { getAuthorName } from '@/src/shared/lib/dataHelpers';
import { ThemeColors } from '@/src/shared/theme';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlockWrapper } from './BlockWrapper';

interface SavedQuotesBlockProps {
    quotes: Quote[];
    onQuotePress: (quote: Quote) => void;
    onRemove?: () => void;
}

const SavedQuotesBlockUI: React.FC<SavedQuotesBlockProps> = ({ quotes, onQuotePress, onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const hasQuotes = quotes && quotes.length > 0;

    if (!hasQuotes) {
        return (
            <BlockWrapper blockKey="savedQuotes" onRemove={onRemove}>
                <Text style={styles.fallbackText}>
                    Aucune citation sauvegardée pour ce livre.
                </Text>
            </BlockWrapper>
        );
    }

    return (
        <BlockWrapper blockKey="savedQuotes" onRemove={onRemove}>
            <View style={styles.savedQuotesList}>
                {quotes.map(quote => (
                    <TouchableOpacity
                        key={quote.id}
                        style={styles.savedQuoteCard}
                        activeOpacity={0.85}
                        onPress={() => onQuotePress(quote)}
                    >
                        <Text style={styles.savedQuoteText}>{quote.text}</Text>
                        <View style={styles.savedQuoteMeta}>
                            <Text style={styles.savedQuoteAuthor}>{getAuthorName(quote.author)}</Text>
                            <Text style={styles.savedQuoteDate}>{quote.savedAt || quote.date}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </BlockWrapper>
    );
};

export const SavedQuotesBlock = React.memo(SavedQuotesBlockUI, (prevProps, nextProps) => {
    return (
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
});
