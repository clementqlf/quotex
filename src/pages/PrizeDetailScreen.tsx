import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Award, User, BookOpen, Calendar } from 'lucide-react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { PrizeService } from '@/src/shared/api/PrizeService';
import { LiteraryPrize, Laureate } from '@/src/shared/api/types';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { API_BASE_URL } from '@/src/shared/config/api';
import { authService } from '@/src/entities/user/api/AuthService';

interface PrizeDetailScreenProps {
    prizeId: number;
}

export default function PrizeDetailScreen({ prizeId }: PrizeDetailScreenProps) {
    const router = useRouter();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { navigateToAuthor, navigateToBook } = useSmartNavigation();

    const [prize, setPrize] = useState<LiteraryPrize | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const BATCH_SIZE = 25;
    // Track which book IDs are currently being enriched to avoid duplicate calls
    const enrichingBookIds = useRef<Set<number>>(new Set());

    /**
     * Fire-and-forget: enrich laureate books that have no cover.
     * Each successful response patches the local prize state immediately
     * without any reload or loading indicator.
     */
    const enrichMissingCovers = async (laureates: Laureate[]) => {
        const token = await authService.getToken().catch(() => null);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const booksToEnrich = laureates.filter(
            l => l.book?.id && !l.book.cover && !enrichingBookIds.current.has(l.book.id!)
        );

        for (const laureate of booksToEnrich) {
            const bookId = laureate.book!.id!;
            enrichingBookIds.current.add(bookId);

            // Fire-and-forget: no await in the loop, all run concurrently
            fetch(`${API_BASE_URL}/books/${bookId}/enrich`, { method: 'POST', headers })
                .then(res => (res.ok ? res.json() : null))
                .then(enrichedBook => {
                    if (enrichedBook?.cover) {
                        // Patch only the cover of this specific book in local state
                        setPrize(prev => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                laureates: prev.laureates?.map(l =>
                                    l.book?.id === bookId
                                        ? { ...l, book: { ...l.book!, cover: enrichedBook.cover } }
                                        : l
                                ),
                            };
                        });
                    }
                })
                .catch(e => console.warn(`[PrizeDetail] Enrich failed for book ${bookId}:`, e))
                .finally(() => enrichingBookIds.current.delete(bookId));
        }
    };

    const fetchExternalPrizeDetails = async (inventaireUri: string) => {
        if (!inventaireUri.startsWith('wd:')) return null;
        const qid = inventaireUri.substring(3);
        try {
            const sparql = `
            SELECT ?inception ?conferredByLabel ?founderLabel WHERE {
              OPTIONAL { wd:${qid} wdt:P571 ?inception . }
              OPTIONAL {
                wd:${qid} wdt:P1027 ?conferredBy .
                OPTIONAL { ?conferredBy rdfs:label ?lblFr. FILTER(LANG(?lblFr) = "fr") }
                OPTIONAL { ?conferredBy rdfs:label ?lblEn. FILTER(LANG(?lblEn) = "en") }
                BIND(COALESCE(?lblFr, ?lblEn) AS ?conferredByLabel)
              }
              OPTIONAL {
                wd:${qid} wdt:P112 ?founder .
                OPTIONAL { ?founder rdfs:label ?lblFounderFr. FILTER(LANG(?lblFounderFr) = "fr") }
                OPTIONAL { ?founder rdfs:label ?lblFounderEn. FILTER(LANG(?lblFounderEn) = "en") }
                BIND(COALESCE(?lblFounderFr, ?lblFounderEn) AS ?founderLabel)
              }
            } LIMIT 1
            `;
            const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
                    'Accept': 'application/sparql-results+json'
                }
            });
            if (!res.ok) return null;
            const data = await res.json();
            const binding = data.results?.bindings?.[0];
            if (!binding) return null;

            const inceptionRaw = binding.inception?.value;
            const inceptionYear = inceptionRaw ? inceptionRaw.substring(0, 4) : null;
            const founder = binding.conferredByLabel?.value || binding.founderLabel?.value || null;

            return { inceptionYear, founder };
        } catch (e) {
            console.error('[PrizeDetail] Failed to fetch external prize details:', e);
            return null;
        }
    };

    const fetchWikipediaDescription = async (title: string): Promise<string | null> => {
        try {
            const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=6&explaintext=1&exintro=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            const pages = data.query?.pages;
            if (!pages) return null;
            const pageId = Object.keys(pages)[0];
            if (pageId === '-1') return null;
            const extract = pages[pageId]?.extract;
            return extract && extract.trim().length > 0 ? extract.trim() : null;
        } catch (e) {
            console.warn('[PrizeDetail] Failed to fetch Wikipedia description:', e);
            return null;
        }
    };

    const fetchPrizeDetails = async () => {
        try {
            const data = await PrizeService.getById(prizeId);
            if (data) {
                setPrize(data);
                // Immediately trigger background enrichment for books without covers
                if (data.laureates) {
                    enrichMissingCovers(data.laureates);
                }
                
                // Fetch external metadata if we have a Wikidata/Inventaire URI
                if (data.inventaireUri) {
                    fetchExternalPrizeDetails(data.inventaireUri).then(extData => {
                        if (extData) {
                            setPrize(prev => prev ? {
                                ...prev,
                                inceptionYear: extData.inceptionYear || undefined,
                                founder: extData.founder || undefined
                            } : null);
                        }
                    });
                }

                // If description is missing or too short (e.g. less than 50 chars), enrich it from Wikipedia
                const currentDesc = data.description || '';
                if (currentDesc.length < 50 || currentDesc.toLowerCase() === 'prix littéraire français') {
                    const wikiTitle = data.wikipediaTitle || data.name;
                    fetchWikipediaDescription(wikiTitle).then(wikiDesc => {
                        if (wikiDesc) {
                            setPrize(prev => prev ? {
                                ...prev,
                                description: wikiDesc
                            } : null);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch prize details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadNextBatch = async () => {
        if (isFetchingMore || !hasMore || !prize?.inventaireUri) return;

        setIsFetchingMore(true);
        try {
            const currentOffset = prize.laureates?.length || 0;
            console.log(`[PrizeDetail] Loading next batch starting from offset: ${currentOffset}`);
            
            const res = await PrizeService.syncPrize({
                prizeUri: prize.inventaireUri,
                offset: currentOffset,
                limit: BATCH_SIZE
            });

            if (res && res.laureatesCount > 0) {
                // Fetch the updated prize model with the newly synced laureates from DB
                const updatedPrize = await PrizeService.getById(prizeId);
                if (updatedPrize) {
                    setPrize(updatedPrize);
                    // Proactively trigger background covers enrichment for the new batch
                    if (updatedPrize.laureates) {
                        enrichMissingCovers(updatedPrize.laureates);
                    }
                }
                
                // If Wikidata has no more items, disable future scrolling requests
                if (res.hasMore === false || res.laureatesCount < BATCH_SIZE) {
                    setHasMore(false);
                }
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('[PrizeDetail] Failed to load next batch:', error);
        } finally {
            setIsFetchingMore(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchPrizeDetails();
        }, [prizeId])
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centerContainer]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!prize) {
        return (
            <View style={[styles.container, styles.centerContainer]}>
                <Text style={styles.errorText}>Prix non trouvé.</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButtonInline}>
                    <Text style={styles.backButtonText}>Retour</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderLaureate = ({ item }: { item: Laureate }) => {
        const authorName = item.author?.name || '';
        const authorInventaireUri = item.author?.inventaireUri;
        const bookInventaireUri = item.book?.inventaireUri;
        const coverUrl = item.book?.cover || null;

        return (
            <View style={styles.laureateCard}>
                <View style={styles.laureateCardContent}>
                    {/* Cover */}
                    <TouchableOpacity
                        onPress={() => item.book ? navigateToBook(item.book.id ?? item.book.title, bookInventaireUri) : null}
                        disabled={!item.book}
                    >
                        {coverUrl ? (
                            <Image source={{ uri: coverUrl }} style={styles.laureateCover} />
                        ) : (
                            <View style={styles.laureateCoverPlaceholder}>
                                <BookOpen size={24} color={colors.textTertiary} />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Info */}
                    <View style={styles.laureateCardInfo}>
                        <View style={styles.laureateCardHeader}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                {item.book ? (
                                    <TouchableOpacity
                                        onPress={() => navigateToBook(item.book!.id ?? item.book!.title, bookInventaireUri)}
                                    >
                                        <Text style={styles.laureateBookTitle} numberOfLines={2}>
                                            {item.book.title}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.laureateBookTitle}>Œuvre non renseignée</Text>
                                )}
                            </View>
                            <View style={styles.yearBadge}>
                                <Text style={styles.yearBadgeText}>{item.year}</Text>
                            </View>
                        </View>

                        <TouchableOpacity onPress={() => navigateToAuthor(authorName, authorInventaireUri)}>
                            <Text style={styles.laureateAuthorName}>{authorName}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Prix Littéraire</Text>
            </View>

            <FlatList
                data={prize.laureates?.sort((a, b) => b.year - a.year) || []}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderLaureate}
                onEndReached={loadNextBatch}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    isFetchingMore ? (
                        <View style={styles.footerLoader}>
                            <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                    ) : null
                }
                ListHeaderComponent={
                    <View style={styles.prizeHeaderContainer}>
                        <View style={styles.prizeHeader}>
                            <View style={styles.prizeImageContainer}>
                                {prize.image ? (
                                    <Image source={{ uri: prize.image }} style={styles.prizeImage} />
                                ) : (
                                    <Award size={48} color={colors.primary} />
                                )}
                            </View>
                            <Text style={styles.prizeName}>{prize.name}</Text>
                        </View>

                        {prize.description && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Award size={16} color={colors.primary} />
                                    <Text style={styles.sectionTitle}>À propos du prix</Text>
                                </View>
                                <Text style={styles.prizeDesc}>{prize.description}</Text>
                            </View>
                        )}

                        <View style={styles.detailContainerSection}>
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
                        
                        <View style={styles.divider} />
                        <Text style={styles.palmaresTitle}>Palmarès</Text>
                    </View>
                }
                contentContainerStyle={styles.listContent}
            />
        </SafeAreaView>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        flex: 1,
    },
    prizeHeaderContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    prizeHeader: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    prizeImageContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        overflow: 'hidden',
    },
    prizeImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    prizeName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    section: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    prizeDesc: {
        fontSize: 14,
        lineHeight: 22,
        color: colors.textSecondary,
    },
    detailContainerSection: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    detailsContainer: {
        flexDirection: 'row',
        gap: 12,
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
    divider: {
        height: 1,
        backgroundColor: colors.border,
        width: '100%',
        marginVertical: 24,
    },
    palmaresTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        alignSelf: 'flex-start',
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 40,
    },
    footerLoader: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    laureateCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        overflow: 'hidden',
    },
    laureateCardContent: {
        flexDirection: 'row',
        padding: 12,
    },
    laureateCover: {
        width: 60,
        height: 90,
        borderRadius: 4,
        backgroundColor: colors.surfaceHighlight,
    },
    laureateCoverPlaceholder: {
        width: 60,
        height: 90,
        borderRadius: 4,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    laureateCardInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    laureateCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    laureateAuthorName: {
        fontSize: 14,
        color: colors.primary,
        marginTop: 2,
    },
    yearBadge: {
        backgroundColor: colors.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    yearBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textTertiary,
    },
    laureateBookTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    errorText: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 16,
    },
    backButtonInline: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.primary,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    }
});
