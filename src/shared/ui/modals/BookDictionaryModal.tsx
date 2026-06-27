import { useTheme } from '@/src/app/providers/ThemeContext';
import { fetchDefinition } from '@/src/shared/api/WiktionaryService';
import { ThemeColors } from '@/src/shared/theme';
import { Check, Plus, Search, Trash2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface DefinitionItem {
    term: string;
    genre: string;
    definition: string;
    example: string;
    source?: 'quote' | 'manual'; // To track origin if needed
}

interface BookDictionaryModalProps {
    visible: boolean;
    onClose: () => void;
    // All available definitions (from quotes + manual)
    availableDefinitions: DefinitionItem[];
    // IDs or terms that are currently "visible" or "selected" for the block
    // If null/undefined, we assume all are visible unless hidden
    // Let's use a list of terms that are HIDDEN, it's easier if the default is "Show All"
    hiddenTerms: string[];
    onUpdate: (manualDefinitions: DefinitionItem[], hiddenTerms: string[]) => void;
    currentManualDefinitions: DefinitionItem[]; // PASSED separately so we can manage them
}

export default function BookDictionaryModal({
    visible,
    onClose,
    availableDefinitions,
    hiddenTerms,
    onUpdate,
    currentManualDefinitions
}: BookDictionaryModalProps) {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const [localHiddenTerms, setLocalHiddenTerms] = useState<Set<string>>(new Set(hiddenTerms));
    const [localManualDefinitions, setLocalManualDefinitions] = useState<DefinitionItem[]>(currentManualDefinitions);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<DefinitionItem | null>(null);

    const [prevVisible, setPrevVisible] = useState(false);
    const [prevHiddenTerms, setPrevHiddenTerms] = useState<string[]>([]);
    const [prevManualDefs, setPrevManualDefs] = useState<DefinitionItem[]>([]);

    if (visible !== prevVisible || hiddenTerms !== prevHiddenTerms || currentManualDefinitions !== prevManualDefs) {
        setPrevVisible(visible);
        setPrevHiddenTerms(hiddenTerms);
        setPrevManualDefs(currentManualDefinitions);
        
        setLocalHiddenTerms(new Set(hiddenTerms));
        setLocalManualDefinitions(currentManualDefinitions);
        setSearchQuery('');
        setSearchResult(null);
    }

    const toggleVisibility = (term: string) => {
        const newSet = new Set(localHiddenTerms);
        if (newSet.has(term)) {
            newSet.delete(term);
        } else {
            newSet.add(term);
        }
        setLocalHiddenTerms(newSet);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setSearchResult(null);
        try {
            const def = await fetchDefinition(searchQuery.trim());
            if (def && def.length > 0) {
                setSearchResult(def[0]);
            } else {
                // Fallback
                setSearchResult({
                    term: searchQuery.trim(),
                    genre: 'Non trouvée',
                    definition: "Aucune définition trouvée.",
                    example: ''
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const addManualDefinition = () => {
        if (searchResult) {
            // Check if already exists in MANUAL list
            if (!localManualDefinitions.find(d => d.term.toLowerCase() === searchResult.term.toLowerCase())) {
                const newList = [...localManualDefinitions, { ...searchResult, source: 'manual' as const }];
                setLocalManualDefinitions(newList);
                // Ensure it's not hidden
                if (localHiddenTerms.has(searchResult.term.toLowerCase())) {
                    const newHidden = new Set(localHiddenTerms);
                    newHidden.delete(searchResult.term.toLowerCase());
                    setLocalHiddenTerms(newHidden);
                }
            }
            setSearchQuery('');
            setSearchResult(null);
        }
    };

    const removeManualDefinition = (term: string) => {
        setLocalManualDefinitions(prev => prev.filter(d => d.term !== term));
    };

    const handleConfirm = () => {
        onUpdate(localManualDefinitions, Array.from(localHiddenTerms));
        onClose();
    };

    // Combine logic:
    const combinedMap = new Map<string, DefinitionItem>();

    availableDefinitions.forEach(d => combinedMap.set(d.term.toLowerCase(), { ...d, source: 'quote' }));
    localManualDefinitions.forEach(d => combinedMap.set(d.term.toLowerCase(), { ...d, source: 'manual' }));

    const sortedTerms = Array.from(combinedMap.values()).sort((a, b) => a.term.localeCompare(b.term));

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.content}>

                    <View style={styles.header}>
                        <Text style={styles.title}>Gérer le dictionnaire</Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                            accessible={true}
                            accessibilityLabel="Fermer"
                            accessibilityRole="button"
                            testID="close-dictionary-modal-button"
                        >
                            <X size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.body}>
                        {/* Add Section */}
                        <View style={styles.addSection}>
                            <Text style={styles.sectionHeader}>Ajouter un mot</Text>
                            <View style={styles.searchRow}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Chercher un mot..."
                                    placeholderTextColor={colors.inputPlaceholder}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    onSubmitEditing={handleSearch}
                                    accessible={true}
                                    accessibilityLabel="Terme à rechercher"
                                    testID="search-term-input"
                                />
                                <TouchableOpacity
                                    style={styles.searchButton}
                                    onPress={handleSearch}
                                    disabled={isSearching}
                                    accessible={true}
                                    accessibilityLabel="Rechercher"
                                    accessibilityRole="button"
                                    testID="search-term-button"
                                >
                                    {isSearching ? <ActivityIndicator color={colors.buttonText} size="small" /> : <Search size={20} color={colors.buttonText} />}
                                </TouchableOpacity>
                            </View>
                            {searchResult && (
                                <View style={styles.resultPreview}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.previewTerm}>{searchResult.term} <Text style={styles.previewGenre}>{searchResult.genre}</Text></Text>
                                        <Text numberOfLines={2} style={styles.previewDef}>{searchResult.definition}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={addManualDefinition}
                                        accessible={true}
                                        accessibilityLabel="Ajouter manuellement une définition"
                                        accessibilityRole="button"
                                        testID="add-definition-button"
                                    >
                                        <Plus size={20} color={colors.buttonText} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        <View style={styles.divider} />

                        {/* List Section */}
                        <Text style={styles.sectionHeader}>Mots enregistrés ({sortedTerms.length})</Text>
                        <Text style={styles.subHeader}>Décochez pour masquer du résumé</Text>

                        <ScrollView style={styles.listArea}>
                            {sortedTerms.map((item, index) => {
                                const isHidden = localHiddenTerms.has(item.term.toLowerCase());
                                return (
                                    <View key={index} style={styles.listItem}>
                                        <TouchableOpacity
                                            style={[styles.checkbox, !isHidden && styles.checkboxChecked]}
                                            onPress={() => toggleVisibility(item.term.toLowerCase())}
                                            accessible={true}
                                            accessibilityLabel={`Sélectionner la définition pour ${item.term}`}
                                            accessibilityRole="checkbox"
                                            accessibilityState={{ checked: !isHidden }}
                                        >
                                            {!isHidden && <Check size={14} color={colors.buttonText} />}
                                        </TouchableOpacity>

                                        <View style={styles.listItemContent}>
                                            <Text style={[styles.itemTerm, isHidden && styles.itemTermHidden]}>{item.term}</Text>
                                            <Text style={styles.itemSource}>{item.source === 'manual' ? 'Manuel' : 'Citation'}</Text>
                                        </View>

                                        {item.source === 'manual' && (
                                            <TouchableOpacity
                                                onPress={() => removeManualDefinition(item.term)}
                                                accessible={true}
                                                accessibilityLabel={`Supprimer la définition pour ${item.term}`}
                                                accessibilityRole="button"
                                            >
                                                <Trash2 size={18} color={colors.warning} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                            {sortedTerms.length === 0 && (
                                <Text style={styles.emptyText}>
                                    Aucun mot dans le dictionnaire.
                                </Text>
                            )}
                        </ScrollView>

                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={handleConfirm}
                            accessible={true}
                            accessibilityLabel="Enregistrer le dictionnaire"
                            accessibilityRole="button"
                            testID="confirm-dictionary-button"
                        >
                            <Text style={styles.confirmText}>Enregistrer</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: colors.backdrop,
    },
    content: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    closeButton: {
        padding: 4,
    },
    body: {
        flex: 1,
        padding: 20,
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 12,
    },
    subHeader: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 12,
    },
    addSection: {
        marginBottom: 0,
    },
    searchRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        backgroundColor: colors.inputBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: colors.inputText,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
    },
    searchButton: {
        width: 48,
        backgroundColor: colors.primary,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultPreview: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    previewTerm: {
        color: colors.text,
        fontWeight: '700',
        fontSize: 15,
    },
    previewGenre: {
        color: colors.textTertiary,
        fontSize: 12,
        fontWeight: '400',
        fontStyle: 'italic',
    },
    previewDef: {
        color: colors.textSecondary,
        fontSize: 13,
        marginTop: 2,
    },
    addButton: {
        backgroundColor: colors.primary,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 16,
    },
    listArea: {
        flex: 1,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.textTertiary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    listItemContent: {
        flex: 1,
    },
    itemTerm: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '500',
    },
    itemTermHidden: {
        color: colors.textTertiary,
        textDecorationLine: 'line-through',
    },
    itemSource: {
        color: colors.textTertiary,
        fontSize: 12,
    },
    emptyText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 20,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
    },
    confirmText: {
        color: colors.buttonText,
        fontSize: 16,
        fontWeight: '600',
    },
});
