import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Linking,
} from 'react-native';
import { BookCopy, ExternalLink } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ThemeColors } from '../../src/theme/theme';
import { Book } from '../../types';
import { API_BASE_URL } from '../../src/config/api';

interface Edition {
    id: number;
    inventaireUri: string;
    isbn: string | null;
    title: string | null;
    publishDate: string | null;
    publisherUri: string | null;
    publisherName: string | null;
    languageUri: string | null;
    cover: string | null;
    bookId: number;
}

interface EditionsBlockProps {
    book: Book | null;
    onRemove?: () => void;
}

// Map of known Wikidata language URIs to display names
const LANGUAGE_LABELS: Record<string, string> = {
    'wd:Q150': '🇫🇷 Français',
    'wd:Q1860': '🇬🇧 Anglais',
    'wd:Q188': '🇩🇪 Allemand',
    'wd:Q1321': '🇪🇸 Espagnol',
    'wd:Q652': '🇮🇹 Italien',
    'wd:Q5146': '🇵🇹 Portugais',
    'wd:Q5287': '🇯🇵 Japonais',
    'wd:Q9005': '🇨🇳 Chinois',
    'wd:Q7737': '🇷🇺 Russe',
    'wd:Q7918': '🇸🇪 Suédois',
};

const resolveLanguage = (uri: string | null): string => {
    if (!uri) return '';
    return LANGUAGE_LABELS[uri] || uri.replace('wd:', '');
};

export const EditionsBlock: React.FC<EditionsBlockProps> = ({ book, onRemove }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [editions, setEditions] = useState<Edition[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fetched, setFetched] = useState(false);

    useEffect(() => {
        if (!book?.id || fetched) return;

        const fetchEditions = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/books/${book.id}/editions`);
                if (response.ok) {
                    const data = await response.json();
                    setEditions(data);
                }
            } catch (e) {
                console.error('[EditionsBlock] Fetch error:', e);
            } finally {
                setIsLoading(false);
                setFetched(true);
            }
        };

        fetchEditions();
    }, [book?.id, fetched]);

    const handleOpenInventaire = (uri: string) => {
        // Build an inventaire.io URL from the URI
        // isbn:978... → https://inventaire.io/isbn/978...
        // wd:Q... → https://inventaire.io/entity/wd:Q...
        let url = 'https://inventaire.io';
        if (uri.startsWith('isbn:')) {
            url = `https://inventaire.io/isbn/${uri.replace('isbn:', '')}`;
        } else {
            url = `https://inventaire.io/entity/${encodeURIComponent(uri)}`;
        }
        Linking.openURL(url).catch(() => {});
    };

    // Nothing to show if no inventaireUri on the book
    const hasInventaireUri = !!(book as any)?.inventaireUri;

    if (!hasInventaireUri && !isLoading && editions.length === 0) {
        return null; // Don't render the block if book has no Inventaire data
    }

    return (
        <BlockWrapper blockKey="editions" onRemove={onRemove}>
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Chargement des éditions...</Text>
                </View>
            ) : editions.length === 0 ? (
                <Text style={styles.emptyText}>Aucune édition trouvée sur Inventaire.io</Text>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {editions.map((edition) => (
                        <TouchableOpacity
                            key={edition.id}
                            style={styles.editionCard}
                            onPress={() => handleOpenInventaire(edition.inventaireUri)}
                            activeOpacity={0.8}
                        >
                            {/* Cover */}
                            <View style={styles.coverContainer}>
                                {edition.cover ? (
                                    <Image
                                        source={{ uri: edition.cover }}
                                        style={styles.cover}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={[styles.cover, styles.coverPlaceholder]}>
                                        <BookCopy size={24} color={colors.textTertiary} />
                                    </View>
                                )}
                            </View>

                            {/* Info */}
                            <View style={styles.editionInfo}>
                                {edition.title ? (
                                    <Text numberOfLines={2} style={styles.editionTitle}>
                                        {edition.title}
                                    </Text>
                                ) : null}

                                {edition.publishDate ? (
                                    <Text style={styles.editionMeta}>{edition.publishDate}</Text>
                                ) : null}

                                {edition.isbn ? (
                                    <Text style={styles.editionIsbn} numberOfLines={1}>
                                        {edition.isbn}
                                    </Text>
                                ) : null}

                                {edition.languageUri ? (
                                    <Text style={styles.editionLang} numberOfLines={1}>
                                        {resolveLanguage(edition.languageUri)}
                                    </Text>
                                ) : null}

                                {/* Link icon */}
                                <ExternalLink size={12} color={colors.primary} style={{ marginTop: 4 }} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            <Text style={styles.sourceLabel}>Source : inventaire.io</Text>
        </BlockWrapper>
    );
};

const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        loadingContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 12,
        },
        loadingText: {
            color: colors.textSecondary,
            fontSize: 13,
        },
        emptyText: {
            color: colors.textTertiary,
            fontStyle: 'italic',
            fontSize: 13,
        },
        scrollContent: {
            gap: 12,
            paddingBottom: 4,
        },
        editionCard: {
            width: 120,
            backgroundColor: colors.inputBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        coverContainer: {
            width: '100%',
            aspectRatio: 2 / 3,
        },
        cover: {
            width: '100%',
            height: '100%',
        },
        coverPlaceholder: {
            backgroundColor: colors.surfaceHighlight,
            justifyContent: 'center',
            alignItems: 'center',
        },
        editionInfo: {
            padding: 8,
            gap: 2,
        },
        editionTitle: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.text,
            lineHeight: 15,
        },
        editionMeta: {
            fontSize: 11,
            color: colors.primary,
            fontWeight: '600',
        },
        editionIsbn: {
            fontSize: 9,
            color: colors.textTertiary,
        },
        editionLang: {
            fontSize: 10,
            color: colors.textSecondary,
        },
        sourceLabel: {
            marginTop: 8,
            fontSize: 10,
            color: colors.textTertiary,
            textAlign: 'right',
            fontStyle: 'italic',
        },
    });
