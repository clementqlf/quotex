import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SectionList,
    Image,
    ActivityIndicator,
    Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSmartNavigation } from '@/src/hooks/useSmartNavigation';
import { ArrowLeft, Search, X, BookOpen, User, Hash, Quote as QuoteIcon } from 'lucide-react-native';
import { searchService, SearchResults } from '@/src/services/SearchService';
import { Quote, Book, Author } from '@/types';
import { getBookTitle, getAuthorName } from '@/src/utils/dataHelpers';
import { googleBooksService } from '@/src/services/GoogleBooksService';
import { useTheme } from '@/src/contexts/ThemeContext';
import { ThemeColors } from '@/src/theme/theme';
import { API_BASE_URL } from '@/src/config/api';

type SearchSection =
    | { title: 'Citations'; data: Quote[]; type: 'quote' }
    | { title: 'Mes Livres'; data: Book[]; type: 'book' }
    | { title: 'Auteurs'; data: Author[]; type: 'author' }
    | { title: 'Thèmes'; data: string[]; type: 'theme' }
    | { title: 'Livres'; data: any[]; type: 'inventaire_book' }
    | { title: 'Auteurs (Inventaire)'; data: any[]; type: 'inventaire_author' };

export default function SearchScreen() {
    const router = useRouter();
    const { navigateToBook, navigateToAuthor } = useSmartNavigation();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<SearchResults>({ quotes: [], authors: [], books: [], themes: [], inventaireWorks: [], inventaireAuthors: [] });
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Focus input on mount
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.trim().length > 1) { // Search after 2 chars
                performSearch(query);
            } else {
                setResults({ quotes: [], authors: [], books: [], themes: [], inventaireWorks: [], inventaireAuthors: [] });
            }
        }, 500); // 500ms debounce

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

    const handleImportBook = async (bookData: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/books/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: bookData.label,
                    description: bookData.description || '',
                    cover: bookData.image || '',
                    inventaireUri: bookData.uri,
                    authors: bookData.authors || [],
                    authorUris: bookData.authorUris || [],
                })
            });
            if (response.ok) {
                const importedBook = await response.json();
                navigateToBook(importedBook.id);
            }
        } catch (error) {
            console.error("Failed to import work", error);
        } finally {
            setIsLoading(false);
        }
    };

    const sections: SearchSection[] = [
        { title: 'Thèmes', data: results.themes, type: 'theme' },
        { title: 'Mes Auteurs', data: results.authors, type: 'author' },
        { title: 'Mes Livres', data: results.books, type: 'book' },
        { title: 'Citations', data: results.quotes, type: 'quote' },
        { title: 'Livres', data: results.inventaireWorks || [], type: 'inventaire_book' },
        { title: 'Auteurs', data: results.inventaireAuthors || [], type: 'inventaire_author' },
    ].filter(section => section.data.length > 0) as SearchSection[];

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
                        <Text numberOfLines={2} style={styles.quoteText}>"{quote.text}"</Text>
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
        }
        return null;
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => { setQuery(''); inputRef.current?.focus(); }}>
                            <X size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
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
        backgroundColor: colors.surfaceHighlight, // Used surfaceHighlight instead of colors.gray which doesn't exist
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookCover: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    authorImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
    }
});
