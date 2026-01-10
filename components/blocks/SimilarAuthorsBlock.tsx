import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { Author } from '../../types';

interface SimilarAuthorsBlockProps {
    authors: Author[];
    onAuthorPress: (authorName: string) => void;
    onRemove?: () => void;
}

export const SimilarAuthorsBlock: React.FC<SimilarAuthorsBlockProps> = ({ authors, onAuthorPress, onRemove }) => {
    const hasAuthors = authors && authors.length > 0;

    if (!hasAuthors) {
        return (
            <BlockWrapper blockKey="similarAuthors" onRemove={onRemove}>
                <Text style={styles.fallbackText}>
                    Aucun auteur similaire trouvé.
                </Text>
            </BlockWrapper>
        );
    }

    return (
        <BlockWrapper blockKey="similarAuthors" onRemove={onRemove}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
                {authors.map((author, index) => (
                    <TouchableOpacity
                        key={author.id || author.name || index}
                        style={styles.item}
                        onPress={() => onAuthorPress(author.name)}
                    >
                        <Image
                            source={{ uri: author.image || 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400&h=600&fit=crop' }}
                            style={styles.cover}
                        />
                        <Text numberOfLines={2} style={styles.title}>{author.name}</Text>
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
        height: 100,
        borderRadius: 50, // Circular for authors
        backgroundColor: '#2A2A2A',
        marginBottom: 8,
    },
    title: {
        fontSize: 12,
        color: '#D1D5DB',
        textAlign: 'center',
    },
});
