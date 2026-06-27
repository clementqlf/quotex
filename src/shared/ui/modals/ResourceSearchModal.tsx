import { useTheme } from '@/src/app/providers/ThemeContext';
import { SearchResults } from '@/src/features/search/api/SearchService';
import { getAuthorName } from '@/src/shared/lib/dataHelpers';
import { ThemeColors } from '@/src/shared/theme';
import { FlashList } from '@shopify/flash-list';
import { ArrowRight, BookOpen, Search, User, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSearch, searchLocal } from '@/src/features/search/lib/useSearch';
import { isOffline } from '@/src/shared/lib/offline/networkUtils';

interface ResourceSearchModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (item: { type: 'book' | 'author'; id: string | number; title?: string; name?: string; image?: string; inventaireUri?: string }) => void;
}

export default function ResourceSearchModal({ visible, onClose, onSelect }: ResourceSearchModalProps) {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const [query, setQuery] = useState('');
    const inputRef = useRef<TextInput>(null);

    // Utiliser le hook useSearch pour la recherche
    const { data: serverResults, isLoading, isFetching } = useSearch(query);
    
    // Gérer le fallback offline
    const [results, setResults] = useState<SearchResults | null>(null);
    
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults(null);
            return;
        }
        
        if (isOffline()) {
            // Recherche locale en offline
            searchLocal(query).then(setResults);
        } else {
            // Utiliser les résultats du serveur
            setResults(serverResults || null);
        }
    }, [query, serverResults, isOffline]);

    // Ajuster l'état de recherche pendant la phase de rendu
    const [prevVisible, setPrevVisible] = useState(visible);
    if (visible !== prevVisible) {
        setPrevVisible(visible);
        if (!visible) {
            setQuery('');
        }
    }

    const displayResults = query.trim().length < 2 ? null : results;

    useEffect(() => {
        if (visible) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [visible]);

    const flattenedResults = useMemo(() => {
        if (!displayResults) return [];
        const items: any[] = [];
        
        // Add Local Books
        displayResults.books.forEach(b => items.push({ ...b, type: 'book', label: b.title, subLabel: getAuthorName(b.author) }));
        
        // Add Local Authors
        displayResults.authors.forEach(a => items.push({ ...a, type: 'author', label: a.name, subLabel: 'Auteur' }));
        
        // Add Inventaire Works (if not already in local)
        displayResults.inventaireWorks?.forEach(w => {
            if (!displayResults.books.some(b => b.inventaireUri === w.uri)) {
                items.push({ ...w, type: 'book', id: w.uri, label: w.label, subLabel: w.authors?.join(', ') || 'Inventaire' });
            }
        });

        // Add Inventaire Authors
        displayResults.inventaireAuthors?.forEach(a => {
            if (!displayResults.authors.some(auth => auth.inventaireUri === a.uri)) {
                items.push({ ...a, type: 'author', id: a.uri, label: a.label, subLabel: 'Inventaire' });
            }
        });

        return items;
    }, [displayResults]);

    const renderItem = ({ item }: { item: any }) => {
        const isBook = item.type === 'book';
        const Icon = isBook ? BookOpen : User;

        return (
            <TouchableOpacity 
                style={styles.resultItem}
                onPress={() => onSelect({
                    type: item.type,
                    id: item.id,
                    title: isBook ? item.label : undefined,
                    name: !isBook ? item.label : undefined,
                    image: item.image || item.cover,
                    inventaireUri: item.uri || item.inventaireUri
                })}
            >
                <View style={styles.iconContainer}>
                    { (item.image || item.cover) ? (
                        <Image source={{ uri: item.image || item.cover }} style={styles.image} />
                    ) : (
                        <Icon size={20} color={colors.textTertiary} />
                    )}
                </View>
                <View style={styles.info}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.itemSubLabel}>{item.subLabel}</Text>
                </View>
                <ArrowRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <View style={styles.searchBar}>
                            <Search size={18} color={colors.textTertiary} />
                            <TextInput
                                ref={inputRef}
                                style={styles.input}
                                placeholder="Rechercher un livre ou auteur..."
                                placeholderTextColor={colors.textTertiary}
                                value={query}
                                onChangeText={setQuery}
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={() => setQuery('')}>
                                    <X size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>Annuler</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {isLoading ? (
                            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
                        ) : (
                            <FlashList
                                data={flattenedResults}
                                renderItem={renderItem}
                                keyExtractor={(item, index) => `${item.type}-${item.id || index}`}
                                estimatedItemSize={80}
                                removeClippedSubviews={true}
                                ListEmptyComponent={
                                    query.length > 1 ? (
                                        <View style={styles.emptyState}>
                                            <Text style={styles.emptyText}>{`Aucun résultat pour "${query}"`}</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.emptyState}>
                                            <Text style={styles.emptyText}>Commencez à taper pour rechercher...</Text>
                                        </View>
                                    )
                                }
                            />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: Dimensions.get('window').height * 0.8,
        paddingTop: 16,
    },
    header: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        gap: 8,
    },
    input: {
        flex: 1,
        color: colors.text,
        fontSize: 16,
    },
    closeButton: {
        paddingHorizontal: 4,
    },
    closeText: {
        color: colors.primary,
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceHighlight,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    info: {
        flex: 1,
        marginLeft: 12,
    },
    itemLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    itemSubLabel: {
        fontSize: 12,
        color: colors.textTertiary,
        marginTop: 2,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 14,
    }
});
