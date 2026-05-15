import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Calendar, BookOpen, Star } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { Book } from '@/src/shared/api/types';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

interface BookInfoBlockProps {
    book: Book | null;
    onBookPress?: (bookTitle: string) => void;
    variant?: 'description' | 'info'; // 'description' just text (BookDetail), 'info' with cover (QuoteDetail)
    onRemove?: () => void;
}

export const BookInfoBlock: React.FC<BookInfoBlockProps> = ({ book, onBookPress, variant = 'info', onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

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
                <Text style={styles.bookDesc}>{book.description || "Description non disponible."}</Text>
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
                    <View style={styles.genreBadge}>
                        <Text style={styles.genreText}>{book.genre}</Text>
                    </View>
                </View>
            </TouchableOpacity>
            <Text style={styles.bookDesc}>{book.description}</Text>
        </BlockWrapper>
    );
};

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
