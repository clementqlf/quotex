import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlockWrapper } from './BlockWrapper';
import { Author, Book } from '../../types';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ThemeColors } from '../../src/theme/theme';

interface AuthorBlockProps {
    author: Author | null;
    book?: Book; // Sometimes we pass book to get author info if Author object is missing
    authorName?: string; // Fallback name
    onAuthorPress?: (authorName: string) => void;
    onRemove?: () => void;
}

export const AuthorBlock: React.FC<AuthorBlockProps> = ({ author, book, authorName: nameOverride, onAuthorPress, onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const authorName = nameOverride || (author?.name) || (typeof book?.author === 'string' ? book?.author : book?.author?.name);
    const description = author?.description;

    const handlePress = () => {
        if (onAuthorPress && authorName) onAuthorPress(authorName);
    };

    if (!author && !authorName) {
        return (
            <BlockWrapper blockKey="author" onRemove={onRemove}>
                <Text style={styles.fallbackText}>
                    Informations sur l'auteur non disponibles.
                </Text>
            </BlockWrapper>
        );
    }

    return (
        <BlockWrapper blockKey="author" onRemove={onRemove}>
            <TouchableOpacity onPress={handlePress} disabled={!onAuthorPress}>
                <Text style={styles.authorName}>{authorName}</Text>
                {description && <Text style={styles.authorDesc}>{description}</Text>}
                {!description && (
                    <Text style={styles.fallbackText}>Information détaillée non disponible.</Text>
                )}
            </TouchableOpacity>
        </BlockWrapper>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    fallbackText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 8
    },
    authorName: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
    },
    authorDesc: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 22,
    },
});
