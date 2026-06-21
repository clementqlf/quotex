import { useTheme } from '@/src/app/providers/ThemeContext';
import { Book } from '@/src/shared/api/types';
import { ThemeColors } from '@/src/shared/theme';
import { BookOpen, Calendar, Star } from 'lucide-react-native';
import React, { useMemo, useState, useCallback } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlockWrapper } from './BlockWrapper';

interface BookInfoBlockProps {
    book: Book | null;
    onBookPress?: (bookTitle: string) => void;
    variant?: 'description' | 'info'; // 'description' just text (BookDetail), 'info' with cover (QuoteDetail)
    onRemove?: () => void;
}

const BookInfoBlockUI: React.FC<BookInfoBlockProps> = ({ book, onBookPress, variant = 'info', onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const description = book?.description || '';

    const [isMeasured, setIsMeasured] = useState(false);
    const [showMoreButton, setShowMoreButton] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [prevDescription, setPrevDescription] = useState('');

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

    if (!book) {
        return (
            <BlockWrapper blockKey={variant === 'description' ? 'bookDescription' : 'bookInfo'} onRemove={onRemove}>
                <Text style={styles.fallbackText}>
                    Informations sur le livre non disponibles.
                </Text>
            </BlockWrapper>
        );
    }

    const handlePress = () => {
        if (onBookPress) onBookPress(book.title);
    };

    if (variant === 'description') {
        return (
            <BlockWrapper blockKey="bookDescription" onRemove={onRemove}>
                {description ? (
                    <View pointerEvents="box-none">
                        {!isMeasured && (
                            <Text
                                style={[styles.bookDesc, { position: 'absolute', opacity: 0, left: 0, right: 0 }]}
                                onTextLayout={onTextLayout}
                            >
                                {description}
                            </Text>
                        )}
                        {isMeasured && (
                            <Text
                                style={styles.bookDesc}
                                numberOfLines={isExpanded ? undefined : 10}
                            >
                                {description}
                            </Text>
                        )}
                    </View>
                ) : (
                    <Text style={styles.bookDesc}>Description non disponible.</Text>
                )}
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
    }

    // QuoteDetail variant (with cover and meta)
    return (
        <BlockWrapper blockKey="bookInfo" onRemove={onRemove}>
            <TouchableOpacity style={styles.bookContainer} onPress={handlePress}>
                <Image source={{ uri: book.cover }} style={styles.bookCover} />
                <View style={styles.bookInfo}>
                    <TouchableOpacity onPress={handlePress}>
                        <Text style={styles.bookName}>{book.title}</Text>
                    </TouchableOpacity>
                    <View style={styles.bookMeta}>
                        <View style={styles.metaItem}>
                            <Calendar size={14} color={colors.textSecondary} />
                            <Text style={styles.metaText}>{book.year}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <BookOpen size={14} color={colors.textSecondary} />
                            <Text style={styles.metaText}>{book.pages} p.</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Star size={14} color={colors.primary} fill={colors.primary} />
                            <Text style={styles.metaText}>{book.rating}/5</Text>
                        </View>
                    </View>
                    {book.genre && book.genre !== 'Unknown' && book.genre !== '' && (
                        <View style={styles.genreBadge}>
                            <Text style={styles.genreText}>{book.genre}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
            {description ? (
                <View pointerEvents="box-none">
                    {!isMeasured && (
                        <Text
                            style={[styles.bookDesc, { position: 'absolute', opacity: 0, left: 0, right: 0 }]}
                            onTextLayout={onTextLayout}
                        >
                            {description}
                        </Text>
                    )}
                    {isMeasured && (
                        <Text
                            style={styles.bookDesc}
                            numberOfLines={isExpanded ? undefined : 10}
                        >
                            {description}
                        </Text>
                    )}
                </View>
            ) : null}
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

export const BookInfoBlock = React.memo(BookInfoBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.book?.id === nextProps.book?.id &&
        prevProps.book?.title === nextProps.book?.title &&
        prevProps.variant === nextProps.variant
    );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    fallbackText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 8
    },
    bookDesc: {
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
    bookContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 16,
    },
    bookCover: {
        width: 80,
        height: 120,
        borderRadius: 8,
        backgroundColor: colors.surfaceHighlight,
    },
    bookInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    bookName: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
    },
    bookMeta: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    genreBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.primaryLight,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: colors.primaryLight,
    },
    genreText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '500',
    },
});
