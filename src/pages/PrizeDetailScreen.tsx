import React, { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { ArrowLeft, Award, User, BookOpen } from 'lucide-react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { PrizeService } from '@/src/shared/api/PrizeService';
import { LiteraryPrize, Laureate } from '@/src/shared/api/types';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';

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

    useEffect(() => {
        fetchPrizeDetails();
    }, [prizeId]);

    const fetchPrizeDetails = async () => {
        setIsLoading(true);
        try {
            const data = await PrizeService.getById(prizeId);
            setPrize(data);
        } catch (error) {
            console.error('Failed to fetch prize details:', error);
        } finally {
            setIsLoading(false);
        }
    };

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
                ListHeaderComponent={
                    <View style={styles.prizeHeader}>
                        <View style={styles.prizeImageContainer}>
                            {prize.image ? (
                                <Image source={{ uri: prize.image }} style={styles.prizeImage} />
                            ) : (
                                <Award size={48} color={colors.primary} />
                            )}
                        </View>
                        <Text style={styles.prizeName}>{prize.name}</Text>
                        {prize.description && (
                            <Text style={styles.prizeDescription}>{prize.description}</Text>
                        )}
                        
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>Palmarès</Text>
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
    prizeHeader: {
        alignItems: 'center',
        padding: 24,
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
    prizeDescription: {
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        width: '100%',
        marginVertical: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        alignSelf: 'flex-start',
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    listContent: {
        paddingBottom: 40,
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
