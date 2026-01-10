import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { Book as BookIcon } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { Book } from '../../types';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ThemeColors } from '../../src/theme/theme';

interface SimilarBooksBlockProps {
    books: (Book | any)[]; // Flexible type as sometimes it's partial data or just strings
    onBookPress: (bookTitle: string) => void;
    onRemove?: () => void;
}

export const SimilarBooksBlock: React.FC<SimilarBooksBlockProps> = ({ books, onBookPress, onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const hasBooks = books && books.length > 0;

    if (!hasBooks) {
        return (
            <BlockWrapper blockKey="similarBooks" onRemove={onRemove}>
                <Text style={styles.fallbackText}>
                    Aucun livre similaire trouvé.
                </Text>
            </BlockWrapper>
        );
    }

    // Normalize data (handle string vs object)
    const normalizedBooks = books.map(b => {
        if (typeof b === 'string') return { title: b, cover: null };
        return b;
    });

    return (
        <BlockWrapper blockKey="similarBooks" onRemove={onRemove}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
                {normalizedBooks.map((book, index) => (
                    <TouchableOpacity
                        key={book.id || book.title || index}
                        style={styles.item}
                        onPress={() => onBookPress(book.title)}
                    >
                        {book.cover ? (
                            <Image source={{ uri: book.cover }} style={styles.cover} />
                        ) : (
                            <View style={[styles.cover, styles.placeholderCover]}>
                                <BookIcon size={24} color={colors.textTertiary} />
                            </View>
                        )}
                        <Text numberOfLines={2} style={styles.title}>{book.title}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </BlockWrapper>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    fallbackText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 8
    },
    container: {
        flexGrow: 0,
    },
    item: {
        width: 100,
        marginRight: 12,
    },
    cover: {
        width: 100,
        height: 150,
        borderRadius: 8,
        backgroundColor: colors.surfaceHighlight,
        marginBottom: 8,
    },
    placeholderCover: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
