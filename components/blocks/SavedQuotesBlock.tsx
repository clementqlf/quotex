import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlockWrapper } from './BlockWrapper';
import { Quote } from '../../types';
import { getAuthorName } from '../../src/utils/dataHelpers';

interface SavedQuotesBlockProps {
    quotes: Quote[];
    onQuotePress: (quote: Quote) => void;
    onRemove?: () => void;
}

export const SavedQuotesBlock: React.FC<SavedQuotesBlockProps> = ({ quotes, onQuotePress, onRemove }) => {
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
                            <Text style={styles.savedQuoteDate}>{quote.date}</Text>
                        </View>
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
    savedQuotesList: {
        gap: 12,
    },
    savedQuoteCard: {
        backgroundColor: '#1E1E1E', // Slightly lighter than block
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    savedQuoteText: {
        fontSize: 15,
        color: '#E5E7EB',
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
        borderTopColor: '#333',
        paddingTop: 8,
    },
    savedQuoteAuthor: {
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    savedQuoteDate: {
        fontSize: 10,
        color: '#6B7280',
    },
});
