import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { Book as BookIcon } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { Book } from '../../types';

interface SimilarBooksBlockProps {
    books: (Book | any)[]; // Flexible type as sometimes it's partial data or just strings
    onBookPress: (bookTitle: string) => void;
    onRemove?: () => void;
}

export const SimilarBooksBlock: React.FC<SimilarBooksBlockProps> = ({ books, onBookPress, onRemove }) => {
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
                                <BookIcon size={24} color="#4B5563" />
                            </View>
                        )}
                        <Text numberOfLines={2} style={styles.title}>{book.title}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </BlockWrapper>
    );
};

const styles = StyleSheet.create({
    fallbackText: {
        color: '#9CA3AF',
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
        backgroundColor: '#2A2A2A',
        marginBottom: 8,
    },
    placeholderCover: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 12,
        color: '#D1D5DB',
        textAlign: 'center',
    },
});
