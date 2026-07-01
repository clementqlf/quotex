import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { BlockWrapper } from './BlockWrapper';
import { ExpandableText } from '../ExpandableText';
import { BookOpen, Calendar, Star, User, Award } from 'lucide-react-native';
import { Author, Book, LiteraryPrize } from '@/src/shared/api/types';
import { ThemeColors } from '@/src/shared/theme';

export interface AboutBlockProps {
    type: 'author' | 'book' | 'prize';
    author?: Author | null;
    book?: Book | null;
    prize?: LiteraryPrize | null;
    authorName?: string; // For author fallback
    onAuthorPress?: (authorName: string) => void;
    onBookPress?: (bookTitle: string) => void;
    onRemove?: () => void;
    hideName?: boolean;
    variant?: 'description' | 'info'; // For book block type
}

export const AboutBlockUI: React.FC<AboutBlockProps> = ({
    type,
    author,
    book,
    prize,
    authorName: nameOverride,
    onAuthorPress,
    onBookPress,
    onRemove,
    hideName,
    variant = 'info'
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    if (type === 'author') {
        const authorName = nameOverride || (author?.name) || (typeof book?.author === 'string' ? book?.author : book?.author?.name);
        const description = author?.description;

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
                    {!hideName && <Text style={styles.title}>{authorName}</Text>}
                    {description ? (
                        <ExpandableText text={description} maxLines={10} style={styles.description} />
                    ) : (
                        <Text style={styles.fallbackText}>Information détaillée non disponible.</Text>
                    )}
                </TouchableOpacity>
            </BlockWrapper>
        );
    }

    if (type === 'book') {
        const description = book?.description || '';

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
                        <ExpandableText text={description} maxLines={10} style={styles.description} />
                    ) : (
                        <Text style={styles.description}>Description non disponible.</Text>
                    )}
                </BlockWrapper>
            );
        }

        return (
            <BlockWrapper blockKey="bookInfo" onRemove={onRemove}>
                <TouchableOpacity style={styles.bookContainer} onPress={handlePress}>
                    {book.cover ? (
                        <Image source={{ uri: book.cover }} style={styles.bookCover} />
                    ) : (
                        <View style={styles.bookCoverPlaceholder}>
                            <BookOpen size={24} color={colors.textTertiary} />
                        </View>
                    )}
                    <View style={styles.bookInfo}>
                        <TouchableOpacity onPress={handlePress}>
                            <Text style={styles.title}>{book.title}</Text>
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
                    <ExpandableText text={description} maxLines={10} style={styles.description} />
                ) : null}
            </BlockWrapper>
        );
    }

    if (type === 'prize') {
        if (!prize) return null;

        const description = prize.description || '';

        return (
            <View style={styles.prizeSection}>
                <View style={styles.prizeSectionHeader}>
                    <Award size={16} color={colors.primary} />
                    <Text style={styles.prizeSectionTitle}>À propos du prix</Text>
                </View>

                {description ? (
                    <ExpandableText text={description} maxLines={10} style={styles.description} />
                ) : (
                    <Text style={styles.fallbackText}>Description non disponible.</Text>
                )}

                <View style={styles.detailsContainer}>
                    <View style={styles.detailItem}>
                        <Calendar size={16} color={colors.textTertiary} />
                        <Text style={styles.detailLabel}>Création</Text>
                        <Text style={styles.detailValue}>{prize.inceptionYear || 'Inconnu'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <User size={16} color={colors.textTertiary} />
                        <Text style={styles.detailLabel}>Créateur</Text>
                        <Text style={styles.detailValue}>{prize.founder || 'Inconnu'}</Text>
                    </View>
                </View>
            </View>
        );
    }

    return null;
};

export const AboutBlock = React.memo(AboutBlockUI, (prevProps, nextProps) => {
    if (prevProps.type !== nextProps.type) return false;
    if (prevProps.type === 'author') {
        return (
            prevProps.author?.name === nextProps.author?.name &&
            prevProps.author?.description === nextProps.author?.description &&
            prevProps.authorName === nextProps.authorName &&
            prevProps.book?.title === nextProps.book?.title
        );
    }
    if (prevProps.type === 'book') {
        return (
            prevProps.book?.id === nextProps.book?.id &&
            prevProps.book?.title === nextProps.book?.title &&
            prevProps.book?.description === nextProps.book?.description &&
            prevProps.variant === nextProps.variant
        );
    }
    if (prevProps.type === 'prize') {
        return (
            prevProps.prize?.id === nextProps.prize?.id &&
            prevProps.prize?.description === nextProps.prize?.description &&
            prevProps.prize?.inceptionYear === nextProps.prize?.inceptionYear &&
            prevProps.prize?.founder === nextProps.prize?.founder
        );
    }
    return true;
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    fallbackText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 8
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
    },
    description: {
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
    bookCoverPlaceholder: {
        width: 80,
        height: 120,
        borderRadius: 8,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    bookInfo: {
        flex: 1,
        justifyContent: 'center',
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
    prizeSection: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    prizeSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    prizeSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    detailsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    detailItem: {
        flex: 1,
        alignItems: 'center',
        gap: 6,
    },
    detailLabel: {
        fontSize: 12,
        color: colors.textTertiary,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 13,
        color: colors.text,
        fontWeight: '600',
        textAlign: 'center',
    },
});
