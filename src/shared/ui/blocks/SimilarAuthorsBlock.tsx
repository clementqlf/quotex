import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { Author } from '@/src/shared/api/types';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

interface SimilarAuthorsBlockProps {
    authors: Author[];
    onAuthorPress: (authorName: string, inventaireUri?: string) => void;
    onRemove?: () => void;
}

const SimilarAuthorsBlockUI: React.FC<SimilarAuthorsBlockProps> = ({ authors, onAuthorPress, onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

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
                        onPress={() => onAuthorPress(author.name, author.inventaireUri)}
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

export const SimilarAuthorsBlock = React.memo(SimilarAuthorsBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.authors.length === nextProps.authors.length &&
        prevProps.authors.every((a, i) => a.id === nextProps.authors[i].id)
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
        height: 100,
        borderRadius: 50, // Circular for authors
        backgroundColor: colors.surfaceHighlight,
        marginBottom: 8,
    },
    title: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
