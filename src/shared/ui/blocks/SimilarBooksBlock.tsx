import { useTheme } from '@/src/app/providers/ThemeContext';
import { Book } from '@/src/shared/api/types';
import { ThemeColors } from '@/src/shared/theme';
import { Book as BookIcon } from 'lucide-react-native';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlockWrapper } from './BlockWrapper';

interface SimilarBooksBlockProps {
    books: Book[];
    onBookPress: (bookIdOrTitle: string | number, inventaireUri?: string) => void;
    onRemove?: () => void;
}

const SimilarBooksBlockUI: React.FC<SimilarBooksBlockProps> = ({ books, onBookPress, onRemove }) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

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
        if (typeof b === 'string') {
            return { title: b, cover: null, id: undefined, inventaireUri: undefined };
        }
        return {
            title: b.title,
            cover: b.cover,
            id: b.id,
            inventaireUri: b.inventaireUri
        };
    });

    return (
        <BlockWrapper blockKey="similarBooks" onRemove={onRemove}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
                {normalizedBooks.map((book, index) => (
                    <TouchableOpacity
                        key={book.id || book.title || index}
                        style={styles.item}
                        onPress={() => onBookPress(book.id ?? book.title, book.inventaireUri)}
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

export const SimilarBooksBlock = React.memo(SimilarBooksBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.books.length === nextProps.books.length &&
        prevProps.books.every((b, i) => {
            const prevId = typeof b === 'string' ? b : b.id || b.title;
            const nextB = nextProps.books[i];
            const nextId = typeof nextB === 'string' ? nextB : nextB.id || nextB.title;
            return prevId === nextId;
        })
    );
});

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
