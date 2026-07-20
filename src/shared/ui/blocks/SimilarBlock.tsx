import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { BlockWrapper } from './BlockWrapper';
import { Avatar } from '@/src/shared/ui/Avatar';
import { BookCover } from '@/src/shared/ui/BookCover';

export interface SimilarItem {
    id?: number;
    title: string; // book title or author name
    image?: string | null;
    inventaireUri?: string;
}

export interface SimilarBlockProps {
    type: 'book' | 'author';
    items: SimilarItem[];
    onPress: (idOrTitle: string | number, inventaireUri?: string) => void;
    onRemove?: () => void;
}

const SimilarBlockUI: React.FC<SimilarBlockProps> = ({ type, items, onPress, onRemove }) => {
    const { colors } = useTheme();
    const styles = createStyles(colors, type);

    const hasItems = items && items.length > 0;

    const displayedItems = React.useMemo(() => {
        return (items || []).slice(0, 10);
    }, [items]);

    if (!hasItems) {
        return (
            <BlockWrapper blockKey={type === 'book' ? 'similarBooks' : 'similarAuthors'} onRemove={onRemove}>
                <Text style={styles.fallbackText}>
                    {type === 'book' ? 'Aucun livre similaire trouvé.' : 'Aucun auteur similaire trouvé.'}
                </Text>
            </BlockWrapper>
        );
    }

    return (
        <BlockWrapper blockKey={type === 'book' ? 'similarBooks' : 'similarAuthors'} onRemove={onRemove}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
                {displayedItems.map((item, index) => {
                    return (
                        <TouchableOpacity
                            key={item.id || item.title || index}
                            style={styles.item}
                            onPress={() => onPress(type === 'book' ? (item.id ?? item.title) : item.title, item.inventaireUri)}
                        >
                            {type === 'author' ? (
                                <Avatar uri={item.image} name={item.title} size={100} style={styles.image} />
                            ) : (
                                <BookCover
                                    uri={item.image}
                                    width={100}
                                    height={150}
                                    borderRadius={8}
                                    fallbackIcon="book"
                                    style={styles.image}
                                />
                            )}
                            <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </BlockWrapper>
    );
};

export const SimilarBlock = React.memo(SimilarBlockUI, (prevProps, nextProps) => {
    if (prevProps.type !== nextProps.type) return false;
    return (
        prevProps.items.length === nextProps.items.length &&
        prevProps.items.every((item, i) => {
            const prevId = item.id || item.title;
            const nextItem = nextProps.items[i];
            const nextId = nextItem?.id || nextItem?.title;
            return prevId === nextId;
        })
    );
});

const createStyles = (colors: ThemeColors, type: 'book' | 'author') => StyleSheet.create({
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
    image: {
        width: 100,
        height: type === 'book' ? 150 : 100,
        borderRadius: type === 'book' ? 8 : 50,
        backgroundColor: colors.surfaceHighlight,
        marginBottom: 8,
    },
    placeholderImage: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
