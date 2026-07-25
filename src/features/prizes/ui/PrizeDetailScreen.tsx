import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { httpClient } from '@/src/shared/api/HttpClient';
import { PrizeService } from '@/src/shared/api/PrizeService';
import { LiteraryPrize, LiteraryPrizeLaureate } from '@/src/shared/api/types';
import { AboutBlock } from '@/src/shared/ui/blocks/AboutBlock';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors, tokens as defaultTokens } from '@/src/shared/theme';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router'; import { useRouter } from '@/src/shared/navigation/useRouter';
import { ArrowLeft, Award, BookOpen } from 'lucide-react-native';
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

// Wikipedia and Wikidata enrichment are handled on the server side via syncPrize

export default function PrizeDetailScreen({ prizeId, prizeData }: PrizeDetailScreenProps) {
    const router = useRouter();
    const { colors, tokens = defaultTokens } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, tokens), [colors, tokens]);
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
                    
                    // If description is missing/too short, or metadata is missing, sync in background
                    const currentDesc = prize.description || '';
                    const needsDescription = currentDesc.length < 50 || currentDesc.toLowerCase() === 'prix littéraire français';
                    const needsMetadata = !prize.inceptionYear || !prize.founder;

                    if (resolvedPrizeId && prize.inventaireUri && (needsDescription || needsMetadata)) {
                        console.log('[PrizeDetail] Prize missing full metadata or description in DB, triggering backend sync...');
                        PrizeService.syncPrize({ prizeUri: prize.inventaireUri })
                            .then(() => {
                                console.log('[PrizeDetail] Sync completed, invalidating query cache...');
                                queryClient.invalidateQueries({ queryKey: ['prize', resolvedPrizeId] });
                            })
                            .catch(e => console.warn('[PrizeDetail] Background sync for metadata enrichment failed:', e));
                    }
                } catch (error) {
                    console.error('[PrizeDetail] Failed to enrich prize:', error);
                }
            };
            enrich();
        }, [prize, enrichMissingCovers, resolvedPrizeId, queryClient])
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
                removeClippedSubviews={true}
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

                        <AboutBlock
                            type="prize"
                            prize={prize}
                        />
                        
                        <View style={styles.divider} />
                        <Text style={styles.palmaresTitle}>Palmarès</Text>
                    </View>
                }
                contentContainerStyle={styles.listContent}
            />
        </SafeAreaView>
    );
}

const createStyles = (colors: ThemeColors, tokens: any) => StyleSheet.create({
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
        padding: tokens.spacing.md,
        gap: tokens.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: tokens.spacing.xs,
    },
    headerTitle: {
        fontSize: tokens.typography.fontSize.lg,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: colors.text,
        flex: 1,
    },
    prizeHeaderContainer: {
        paddingHorizontal: tokens.spacing.md,
        paddingTop: tokens.spacing.sm,
    },
    prizeHeader: {
        alignItems: 'center',
        paddingVertical: tokens.spacing.lg,
    },
    prizeImageContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: tokens.spacing.md,
        overflow: 'hidden',
    },
    prizeImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    prizeName: {
        fontSize: tokens.typography.fontSize.xxl,
        fontWeight: tokens.typography.fontWeight.bold,
        color: colors.text,
        textAlign: 'center',
        marginBottom: tokens.spacing.sm,
    },
    section: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: tokens.radii.lg,
        padding: tokens.spacing.md,
        marginBottom: tokens.spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        marginBottom: tokens.spacing.sm + 4,
    },
    sectionTitle: {
        fontSize: tokens.typography.fontSize.sm,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: colors.text,
    },
    prizeDesc: {
        fontSize: tokens.typography.fontSize.sm,
        lineHeight: tokens.typography.lineHeight.md - 2,
        color: colors.textSecondary,
    },
    detailContainerSection: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: tokens.radii.lg,
        padding: tokens.spacing.md,
        marginBottom: tokens.spacing.lg,
    },
    detailsContainer: {
        flexDirection: 'row',
        gap: tokens.spacing.sm + 4,
    },
    detailItem: {
        flex: 1,
        alignItems: 'center',
        gap: tokens.spacing.xs + 2,
    },
    detailLabel: {
        fontSize: tokens.typography.fontSize.xs,
        color: colors.textTertiary,
        fontWeight: tokens.typography.fontWeight.medium,
    },
    detailValue: {
        fontSize: tokens.typography.fontSize.xs + 1,
        color: colors.text,
        fontWeight: tokens.typography.fontWeight.semibold,
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        width: '100%',
        marginVertical: tokens.spacing.lg,
    },
    palmaresTitle: {
        fontSize: tokens.typography.fontSize.lg,
        fontWeight: tokens.typography.fontWeight.bold,
        color: colors.text,
        alignSelf: 'flex-start',
        marginBottom: tokens.spacing.md,
    },
    listContent: {
        paddingBottom: tokens.spacing.xxl,
    },
    footerLoader: {
        paddingVertical: tokens.spacing.xl - 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    laureateCard: {
        backgroundColor: colors.surface,
        borderRadius: tokens.radii.md,
        marginHorizontal: tokens.spacing.md,
        marginBottom: tokens.spacing.sm + 4,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        overflow: 'hidden',
    },
    laureateCardContent: {
        flexDirection: 'row',
        padding: tokens.spacing.sm + 4,
    },
    laureateCover: {
        width: 60,
        height: 90,
        borderRadius: tokens.radii.xs,
        backgroundColor: colors.surfaceHighlight,
    },
    laureateCoverPlaceholder: {
        width: 60,
        height: 90,
        borderRadius: tokens.radii.xs,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    laureateCardInfo: {
        flex: 1,
        marginLeft: tokens.spacing.md,
        justifyContent: 'center',
    },
    laureateCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: tokens.spacing.xs,
    },
    laureateAuthorName: {
        fontSize: tokens.typography.fontSize.sm,
        color: colors.primary,
        marginTop: 2,
    },
    yearBadge: {
        backgroundColor: colors.surfaceHighlight,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: 2,
        borderRadius: tokens.radii.xs,
    },
    yearBadgeText: {
        fontSize: tokens.typography.fontSize.xs,
        fontWeight: tokens.typography.fontWeight.bold,
        color: colors.textTertiary,
    },
    laureateBookTitle: {
        fontSize: tokens.typography.fontSize.md,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: colors.text,
    },
    errorText: {
        fontSize: tokens.typography.fontSize.md,
        color: colors.textSecondary,
        marginBottom: tokens.spacing.md,
    },
    backButtonInline: {
        paddingVertical: tokens.spacing.sm,
        paddingHorizontal: tokens.spacing.md,
        backgroundColor: colors.primary,
        borderRadius: tokens.radii.sm,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontWeight: tokens.typography.fontWeight.semibold,
    }
});
