import { useTheme } from '@/src/app/providers/ThemeContext';
import { Author, Book } from '@/src/shared/api/types';
import { ThemeColors } from '@/src/shared/theme';
import React, { useMemo, useState, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlockWrapper } from './BlockWrapper';

interface AuthorBlockProps {
    author: Author | null;
    book?: Book; // Sometimes we pass book to get author info if Author object is missing
    authorName?: string; // Fallback name
    onAuthorPress?: (authorName: string) => void;
    onRemove?: () => void;
}

const AuthorBlockUI: React.FC<AuthorBlockProps> = ({ author, book, authorName: nameOverride, onAuthorPress, onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const authorName = nameOverride || (author?.name) || (typeof book?.author === 'string' ? book?.author : book?.author?.name);
    const description = author?.description;

    const [isMeasured, setIsMeasured] = useState(false);
    const [showMoreButton, setShowMoreButton] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [prevDescription, setPrevDescription] = useState(description);

    if (description !== prevDescription) {
        setPrevDescription(description);
        setIsMeasured(false);
        setShowMoreButton(false);
        setIsExpanded(false);
    }

    const onTextLayout = useCallback((e: any) => {
        if (!isMeasured) {
            if (e.nativeEvent.lines.length > 10) {
                setShowMoreButton(true);
            }
            setIsMeasured(true);
        }
    }, [isMeasured]);

    const handlePress = () => {
        if (onAuthorPress && authorName) onAuthorPress(authorName);
    };

    if (!author && !authorName) {
        return (
            <BlockWrapper blockKey="author" onRemove={onRemove}>
                <Text style={styles.fallbackText}>
                    {"Informations sur l'auteur non disponibles."}
                </Text>
            </BlockWrapper>
        );
    }

    return (
        <BlockWrapper blockKey="author" onRemove={onRemove}>
            <TouchableOpacity onPress={handlePress} disabled={!onAuthorPress} activeOpacity={0.7}>
                <Text style={styles.authorName}>{authorName}</Text>
                {description && (
                    <View pointerEvents="box-none">
                        {!isMeasured && (
                            <Text
                                style={[styles.authorDesc, { position: 'absolute', opacity: 0, left: 0, right: 0 }]}
                                onTextLayout={onTextLayout}
                            >
                                {description}
                            </Text>
                        )}
                        {isMeasured && (
                            <Text
                                style={styles.authorDesc}
                                numberOfLines={isExpanded ? undefined : 10}
                            >
                                {description}
                            </Text>
                        )}
                    </View>
                )}
                {!description && (
                    <Text style={styles.fallbackText}>Information détaillée non disponible.</Text>
                )}
            </TouchableOpacity>
            {showMoreButton && (
                <TouchableOpacity
                    style={styles.showMoreButton}
                    onPress={() => setIsExpanded(!isExpanded)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.showMoreText}>
                        {isExpanded ? 'Voir moins' : 'Voir plus'}
                    </Text>
                </TouchableOpacity>
            )}
        </BlockWrapper>
    );
};

export const AuthorBlock = React.memo(AuthorBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.author?.name === nextProps.author?.name &&
        prevProps.authorName === nextProps.authorName &&
        prevProps.book?.title === nextProps.book?.title
    );
});

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
    showMoreButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    showMoreText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
});
