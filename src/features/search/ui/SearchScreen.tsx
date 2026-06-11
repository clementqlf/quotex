import { useTheme } from '@/src/app/providers/ThemeContext';
import { SearchResults, searchService } from '@/src/features/search/api/SearchService';
import { Author, Book, Quote } from '@/src/shared/api/types';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors } from '@/src/shared/theme';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Award, BookOpen, Hash, Quote as QuoteIcon, Scan, Search, User, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SearchSection =
    | { title: string; data: Quote[]; type: 'quote' }
    | { title: string; data: Book[]; type: 'book' }
    | { title: string; data: Author[]; type: 'author' }
    | { title: string; data: string[]; type: 'theme' }
    | { title: string; data: any[]; type: 'prize' }
    | { title: string; data: any[]; type: 'inventaire_book' }
    | { title: string; data: any[]; type: 'inventaire_author' }
    | { title: string; data: any[]; type: 'inventaire_prize' };

export default function SearchScreen() {
    const router = useRouter();
    const { q } = useLocalSearchParams<{ q?: string }>();
    const { navigateToBook, navigateToAuthor } = useSmartNavigation();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [query, setQuery] = useState(q || '');
    const [activeTab, setActiveTab] = useState<'all' | 'books' | 'authors' | 'prizes'>('all');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<SearchResults>({ quotes: [], authors: [], books: [], themes: [], prizes: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] } as any);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Focus input on mount
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.trim().length > 2) { // Search after 3 chars
                performSearch(query);
            } else {
                setResults({ quotes: [], authors: [], books: [], themes: [], prizes: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] } as any);
            }
        }, 500); // 500ms debounce to reduce server load

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const performSearch = async (text: string) => {
        setIsLoading(true);
        try {
            const data = await searchService.search(text);
            setResults(data);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportBook = (item: any) => {
        router.push({
            pathname: '/book-detail',
            params: {
                bookTitle: item.label,
                inventaireUri: item.uri,
                bookData: JSON.stringify(item),
                skipCache: 'true'
            }
        });
    };

    const handleImportPrize = (item: any) => {
        router.push({
            pathname: '/prize-detail',
            params: {
                prizeData: JSON.stringify(item)
            }
        });
    };

    const sections = React.useMemo(() => {
        const allSections: SearchSection[] = [
            { title: 'Thèmes', data: results.themes, type: 'theme' },
            { title: 'Mes Auteurs', data: results.authors, type: 'author' },
            { title: 'Mes Livres', data: results.books, type: 'book' },
            { title: 'Prix Littéraires', data: results.prizes, type: 'prize' },
            { title: 'Citations', data: results.quotes, type: 'quote' },
            { title: 'Prix (Inventaire)', data: (results as any).inventairePrizes || [], type: 'inventaire_prize' },
            { title: 'Livres', data: results.inventaireWorks || [], type: 'inventaire_book' },
            { title: 'Auteurs', data: results.inventaireAuthors || [], type: 'inventaire_author' },
        ];

        return allSections.filter(section => {
            if (section.data.length === 0) return false;
            if (activeTab === 'all') return true;
            if (activeTab === 'books') return section.type === 'book' || section.type === 'inventaire_book';
            if (activeTab === 'authors') return section.type === 'author' || section.type === 'inventaire_author';
            if (activeTab === 'prizes') return section.type === 'prize' || section.type === 'inventaire_prize';
            return false;
        }) as SearchSection[];
    }, [results, activeTab]);

    const renderItem = ({ item, section }: { item: any; section: SearchSection }) => {
        if (section.type === 'quote') {
            const quote = item as Quote;
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => router.push({ pathname: '/quote-detail', params: { quote: JSON.stringify(quote) } })}
                >
                    <View style={styles.quoteIconContainer}>
                        <QuoteIcon size={16} color={colors.primary} fill={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text numberOfLines={2} style={styles.quoteText}>{"\"" + quote.text + "\""}</Text>
                        <Text style={styles.subText}>{getAuthorName(quote.author)} • {getBookTitle(quote.book)}</Text>
                    </View>
                </TouchableOpacity>
            );
        } else if (section.type === 'book') {
            const book = item as Book;
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => navigateToBook(book.id ?? book.title, book.inventaireUri)}
                >
                    <View style={book.cover ? styles.bookCoverContainer : [styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                        {book.cover ? (
                            <Image source={{ uri: book.cover }} style={styles.bookCover} />
                        ) : (
                            <BookOpen size={20} color={colors.primary} />
                        )}
                    </View>
                    <View>
                        <Text style={styles.itemTitle}>{book.title}</Text>
                        <Text style={styles.subText}>{getAuthorName(book.author)}</Text>
                    </View>
                </TouchableOpacity>
            );
        } else if (section.type === 'author') {
            const author = item as Author;
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => navigateToAuthor(author.name, author.inventaireUri)}
                >
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                        {author.image ? (
                            <Image source={{ uri: author.image }} style={styles.authorImage} />
                        ) : (
                            <User size={20} color="#10B981" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{author.name}</Text>
                        <Text style={styles.subText} numberOfLines={2}>{author.description || 'Mon auteur'}</Text>
                    </View>
                </TouchableOpacity>
            );
        } else if (section.type === 'theme') {
            const theme = item as string;
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => router.push({ pathname: '/theme-detail', params: { themeName: theme } })}
                >
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
                        <Hash size={20} color="#EC4899" />
                    </View>
                    <Text style={styles.itemTitle}>{theme}</Text>
                </TouchableOpacity>
            );
        } else if (section.type === 'prize') {
            const prize = item;
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => router.push({ pathname: '/prize-detail', params: { prizeId: prize.id } })}
                >
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                        {prize.image ? (
                            <Image source={{ uri: prize.image }} style={styles.authorImage} />
                        ) : (
                            <Award size={20} color="#F59E0B" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{prize.name}</Text>
                        <Text style={styles.subText} numberOfLines={2}>{prize.description || 'Prix Littéraire'}</Text>
                    </View>
                </TouchableOpacity>
            );
        } else if (section.type === 'inventaire_book') {
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => handleImportBook(item)}
                >
                    <View style={item.image ? styles.bookCoverContainer : [styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.bookCover} />
                        ) : (
                            <BookOpen size={20} color={colors.primary} />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={styles.itemTitle}>{item.label}</Text>
                        </View>
                        <Text style={styles.subText} numberOfLines={1}>{item.authors && item.authors.length > 0 ? item.authors.join(', ') : 'Auteur inconnu'}</Text>
                    </View>
                </TouchableOpacity>
            )
        } else if (section.type === 'inventaire_author') {
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => navigateToAuthor(item.label, item.uri)}
                >
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.authorImage} />
                        ) : (
                            <User size={20} color="#10B981" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{item.label}</Text>
                        <Text style={styles.subText} numberOfLines={2}>{item.description || 'Auteur'}</Text>
                    </View>
                </TouchableOpacity>
            )
        } else if (section.type === 'inventaire_prize') {
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => handleImportPrize(item)}
                >
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.authorImage} />
                        ) : (
                            <Award size={20} color="#F59E0B" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{item.label}</Text>
                        <Text style={styles.subText} numberOfLines={2}>{item.description || 'Importer ce prix'}</Text>
                    </View>
                </TouchableOpacity>
            )
        }
        return null;
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
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
                <View style={styles.searchBar}>
                    <Search size={20} color={colors.textSecondary} />
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder="Rechercher citations, livres..."
                        placeholderTextColor={colors.textSecondary}
                        value={query}
                        onChangeText={setQuery}
                        returnKeyType="search"
                        accessible={true}
                        accessibilityLabel="Rechercher"
                        testID="search-input"
                    />
                    {query.length > 0 ? (
                        <TouchableOpacity
                            onPress={() => { setQuery(''); inputRef.current?.focus(); }}
                            accessible={true}
                            accessibilityLabel="Effacer la recherche"
                            accessibilityRole="button"
                            testID="clear-search-button"
                        >
                            <X size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => router.push('/scan')}
                            style={{ padding: 4 }}
                            accessible={true}
                            accessibilityLabel="Ouvrir le scanner"
                            accessibilityRole="button"
                            testID="scan-button"
                        >
                            <Scan size={20} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Tabs */}
            {query.trim().length > 0 && (
                <View style={styles.tabsContainer}>
                    {[
                        { id: 'all', label: 'Tout' },
                        { id: 'books', label: 'Livres' },
                        { id: 'authors', label: 'Auteurs' },
                        { id: 'prizes', label: 'Prix' }
                    ].map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                            onPress={() => setActiveTab(tab.id as any)}
                            accessible={true}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: activeTab === tab.id }}
                            accessibilityLabel={`Filtrer par ${tab.label}`}
                            testID={`search-tab-${tab.id}`}
                        >
                            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
            {isLoading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <SectionList
                    sections={sections as any}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={renderItem}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{title}</Text>
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        query.length > 1 ? (
                            <View style={styles.centerContainer}>
                                <Text style={styles.emptyText}>Aucun résultat trouvé.</Text>
                            </View>
                        ) : null
                    }
                />
            )}
        </SafeAreaView>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: 4,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBackground,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        gap: 10,
    },
    input: {
        flex: 1,
        color: colors.inputText,
        fontSize: 16,
        height: '100%',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tab: {
        paddingVertical: 12,
        paddingHorizontal: 4,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    activeTabText: {
        color: colors.primary,
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 40,
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.background, // sticky header background
    },
    sectionTitle: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    itemTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '500',
    },
    subText: {
        color: colors.textSecondary,
        fontSize: 14,
        marginTop: 2,
    },
    quoteText: {
        color: colors.text,
        fontSize: 15,
        fontStyle: 'italic',
        marginBottom: 4,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    quoteIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 16,
    },
    bookCoverContainer: {
        width: 45,
        height: 70,
        marginRight: 16,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.surfaceHighlight, 
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookCover: {
        width: '100%',
        height: '100%',
    },
    authorImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
    }
});
