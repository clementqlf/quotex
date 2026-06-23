import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { authService } from '@/src/entities/user/api/AuthService';
import { httpClient } from '@/src/shared/api/HttpClient';
import { PrizeService } from '@/src/shared/api/PrizeService';
import { LiteraryPrize, LiteraryPrizeLaureate } from '@/src/shared/api/types';
import { runSPARQL } from '@/src/entities/author/api/WikidataService';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors } from '@/src/shared/theme';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Award, BookOpen, Calendar, User } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export const PrizeSkeleton = ({ colors }: { colors: ThemeColors }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={{ flex: 1, padding: 16 }}>
       <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
          <Animated.View style={[{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
          <Animated.View style={[{ width: '60%', height: 28, borderRadius: 4, backgroundColor: colors.surfaceHighlight, marginBottom: 8 }, animatedStyle]} />
       </View>
       
       <Animated.View style={[{ width: '100%', height: 120, borderRadius: 16, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
       <Animated.View style={[{ width: '100%', height: 80, borderRadius: 16, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
       
       <Animated.View style={[{ width: '30%', height: 24, borderRadius: 4, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
       <Animated.View style={[{ width: '100%', height: 100, borderRadius: 12, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
       <Animated.View style={[{ width: '100%', height: 100, borderRadius: 12, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
    </View>
  );
};

interface PrizeDetailScreenProps {
    prizeId?: number;
    prizeData?: string;
}

const fetchExternalPrizeDetails = async (inventaireUri: string) => {
    if (!inventaireUri.startsWith('wd:')) return null;
    const qid = inventaireUri.substring(3);
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
    const bindings = await runSPARQL(sparql, 6000);
    const binding = bindings[0];
    if (!binding) return null;

    const inceptionRaw = binding.inception?.value;
    const inceptionYear = inceptionRaw ? inceptionRaw.substring(0, 4) : null;
    const founder = binding.conferredByLabel?.value || binding.founderLabel?.value || null;

    return { inceptionYear, founder };
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

export default function PrizeDetailScreen({ prizeId, prizeData }: PrizeDetailScreenProps) {
    const router = useRouter();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { navigateToAuthor, navigateToBook } = useSmartNavigation();
    const queryClient = useQueryClient();
    
    // State for prizeId resolution (in case we need to sync from prizeData)
    const [resolvedPrizeId, setResolvedPrizeId] = useState<number | undefined>(prizeId);
    const [isEnriching, setIsEnriching] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const BATCH_SIZE = 25;
    // Track which book IDs are currently being enriched to avoid duplicate calls
    const enrichingBookIds = useRef<Set<number>>(new Set());

    // Use TanStack Query for prize data
    const { data: prize, isLoading: isLoadingQuery } = useQuery({
      queryKey: ['prize', resolvedPrizeId],
      queryFn: () => PrizeService.getById(resolvedPrizeId!),
      enabled: !!resolvedPrizeId,
      retry: 2
    });
    
    // Combine loading states
    const isLoading = isLoadingQuery || isEnriching;

    /**
     * Fire-and-forget: enrich laureate books that have no cover.
     * Each successful response patches the local prize state immediately
     * without any reload or loading indicator.
     */
    const enrichMissingCovers = React.useCallback(async (laureates: LiteraryPrizeLaureate[]) => {
        const booksToEnrich = laureates.filter(
            l => l.book?.id && !l.book.cover && !enrichingBookIds.current.has(l.book.id!)
        );

        for (const laureate of booksToEnrich) {
            const bookId = laureate.book!.id!;
            enrichingBookIds.current.add(bookId);

            // Fire-and-forget: no await in the loop, all run concurrently
            httpClient.post<{ cover: string }>(`/books/${bookId}/enrich`, {})
                .then(enrichedBook => {
                    if (enrichedBook?.cover && prize) {
                        // Update query data to patch the cover in the cache
                        queryClient.setQueryData<LiteraryPrize | undefined>(
                            ['prize', resolvedPrizeId],
                            prev => {
                                if (!prev) return prev;
                                return {
                                    ...prev,
                                    laureates: prev.laureates?.map(l =>
                                        l.book?.id === bookId
                                            ? { ...l, book: { ...l.book!, cover: enrichedBook.cover } }
                                            : l
                                    ),
                                };
                            }
                        );
                    }
                })
                .catch(e => console.warn(`[PrizeDetail] Enrich failed for book ${bookId}:`, e))
                .finally(() => enrichingBookIds.current.delete(bookId));
        }
    }, [prize, resolvedPrizeId, queryClient]);

    // Handle prizeData sync to get prizeId
    useFocusEffect(
        React.useCallback(() => {
            const syncAndFetch = async () => {
                if (!resolvedPrizeId && prizeData) {
                    try {
                        setIsEnriching(true);
                        console.log('[PrizeDetail] Prize not found locally, importing from search data...');
                        const pData = JSON.parse(prizeData);
                        const result = await PrizeService.syncPrize({ prizeUri: pData.uri || pData.inventaireUri });
                        if (result && result.success) {
                            setResolvedPrizeId(result.prizeId);
                        }
                    } catch (error) {
                        console.error('[PrizeDetail] Failed to sync prize:', error);
                    } finally {
                        setIsEnriching(false);
                    }
                }
            };
            syncAndFetch();
        }, [resolvedPrizeId, prizeData])
    );
    
    // Enrich prize data after it's loaded
    useFocusEffect(
        React.useCallback(() => {
            if (!prize) return;
            
            const enrich = async () => {
                if (!prize.laureates) return;
                
                try {
                    // Enrich missing covers
                    enrichMissingCovers(prize.laureates);
                    
                    // Fetch external metadata if we have a Wikidata/Inventaire URI
                    if (prize.inventaireUri) {
                        const extData = await fetchExternalPrizeDetails(prize.inventaireUri);
                        if (extData) {
                            // Note: prize comes from useQuery, we can't modify it directly
                            // This would require using queryClient.setQueryData
                        }
                    }
                    
                    // If description is missing or too short, enrich it from Wikipedia
                    const currentDesc = prize.description || '';
                    if (currentDesc.length < 50 || currentDesc.toLowerCase() === 'prix littéraire français') {
                        const wikiTitle = prize.wikipediaTitle || prize.name;
                        const wikiDesc = await fetchWikipediaDescription(wikiTitle);
                        if (wikiDesc) {
                            // Note: prize comes from useQuery, we can't modify it directly
                        }
                    }
                } catch (error) {
                    console.error('[PrizeDetail] Failed to enrich prize:', error);
                }
            };
            enrich();
        }, [prize, enrichMissingCovers])
    );

    const loadNextBatch = async () => {
        if (isFetchingMore || !hasMore || !prize?.inventaireUri || !resolvedPrizeId) return;

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
                // Invalidate query to force refetch with new laureates
                await queryClient.invalidateQueries({ queryKey: ['prize', resolvedPrizeId] });
                
                // Get the updated prize data
                const updatedPrize = await PrizeService.getById(resolvedPrizeId);
                
                // Proactively trigger background covers enrichment for the new batch
                if (updatedPrize?.laureates) {
                    enrichMissingCovers(updatedPrize.laureates);
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

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        accessible={true}
                        accessibilityLabel="Retour"
                        accessibilityRole="button"
                        testID="back-button"
                    >
                        <ArrowLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>Prix Littéraire</Text>
                </View>
                <PrizeSkeleton colors={colors} />
            </SafeAreaView>
        );
    }

    if (!prize) {
        return (
            <View style={[styles.container, styles.centerContainer]}>
                <Text style={styles.errorText}>Prix non trouvé.</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButtonInline}
                    accessible={true}
                    accessibilityLabel="Retour"
                    accessibilityRole="button"
                    testID="back-button"
                >
                    <Text style={styles.backButtonText}>Retour</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderLaureate = ({ item }: { item: LiteraryPrizeLaureate }) => {
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
                        accessible={true}
                        accessibilityLabel={item.book ? `Voir les détails du livre : ${item.book.title}` : "Livre non renseigné"}
                        accessibilityRole="button"
                        testID="laureate-book-cover"
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
                                        accessible={true}
                                        accessibilityLabel={`Voir les détails du livre : ${item.book.title}`}
                                        accessibilityRole="button"
                                        testID="laureate-book-title"
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

                        <TouchableOpacity
                            onPress={() => navigateToAuthor(authorName, authorInventaireUri)}
                            accessible={true}
                            accessibilityLabel={`Voir le profil de l'auteur : ${authorName}`}
                            accessibilityRole="button"
                            testID="laureate-author-name"
                        >
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
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    accessible={true}
                    accessibilityLabel="Retour"
                    accessibilityRole="button"
                    testID="back-button"
                >
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Prix Littéraire</Text>
            </View>

            <FlashList
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
