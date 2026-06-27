import { useTheme } from '@/src/app/providers/ThemeContext';
import { BlockKey } from '@/src/shared/config/blocks';
import { ThemeColors } from '@/src/shared/theme';
import { BookOpen, X } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlockWrapper } from './BlockWrapper';

export interface Definition {
    term: string;
    genre: string;
    pronunciation?: string;
    etymology?: string;
    definition: string;
    example: string;
    exampleSource?: string;
    synonyms?: string[];
}

interface DefinitionBlockProps {
    blockKey?: BlockKey; // 'definition' or 'dictionary'
    definitions: Definition[];
    onEditSelection?: () => void; // For QuoteDetail
    onManageDictionary?: () => void; // For BookDetail
    isAggregated?: boolean; // True for BookDetail (Dictionnaire), False for QuoteDetail (Définition)
    onRemove?: () => void;
}

const DefinitionBlockUI: React.FC<DefinitionBlockProps> = ({
    blockKey = 'definition',
    definitions,
    onEditSelection,
    onManageDictionary,
    isAggregated = false,
    onRemove
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    // Group definitions by term to show them in separate sections
    const groupedDefinitions = useMemo(() => {
        if (!definitions) return [];
        const groups: Record<string, Definition[]> = {};
        definitions.forEach(def => {
            if (!groups[def.term]) {
                groups[def.term] = [];
            }
            groups[def.term].push(def);
        });
        return Object.entries(groups);
    }, [definitions]);

    const hasDefinitions = definitions && definitions.length > 0;

    if (!hasDefinitions) {
        if (isAggregated) {
            return (
                <BlockWrapper blockKey={blockKey} onRemove={onRemove}>
                    <TouchableOpacity onPress={onManageDictionary} disabled={!onManageDictionary}>
                        <Text style={styles.fallbackText}>Aucune définition visible. Cliquez pour gérer.</Text>
                    </TouchableOpacity>
                </BlockWrapper>
            );
        } else {
            return (
                <View style={styles.emptyContainer}>
                    <TouchableOpacity style={styles.emptyBlockContainer} onPress={onEditSelection}>
                        <BookOpen size={24} color={colors.primary} />
                        <Text style={styles.emptyBlockText}>Cliquez pour définir des mots</Text>
                        <Text style={styles.emptyBlockSubtext}>Sélectionner des mots de la citation pour afficher leur définition.</Text>
                    </TouchableOpacity>
                    {onRemove && (
                        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
                            <X size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
            );
        }
    }

    return (
        <BlockWrapper blockKey={blockKey} onRemove={onRemove}>
            <View style={styles.container}>
                {groupedDefinitions.map(([term, termDefs], groupIndex) => {
                    const pronunciation = termDefs[0].pronunciation;
                    const synonyms = termDefs[0].synonyms;

                    return (
                        <View key={term} style={[
                            styles.termSection,
                            groupIndex > 0 && styles.termSectionSeparator
                        ]}>
                            {/* Header Row: TERM [pron] genre */}
                            <View style={styles.header}>
                                <Text style={styles.termText}>{term.toUpperCase()}</Text>
                                {pronunciation && (
                                    <Text style={styles.pronunciationText}>{pronunciation}</Text>
                                )}
                                <Text style={styles.genreText}>{termDefs[0].genre}</Text>
                            </View>

                            {/* Definitions Flow */}
                            <View style={styles.meaningsList}>
                                {termDefs.map((dItem, index) => {
                                    // Extract context from definition if it starts with (xxx)
                                    const contextMatch = dItem.definition.match(/^(\([^)]+\))\s*(.*)/);
                                    const context = contextMatch ? contextMatch[1] : null;
                                    const body = contextMatch ? contextMatch[2] : dItem.definition;

                                    return (
                                        <View key={index} style={styles.meaningRow}>
                                            <Text style={styles.definitionLine}>
                                                <Text style={styles.meaningNumber}>{index + 1}. </Text>
                                                {context && <Text style={styles.contextText}>{context} </Text>}
                                                <Text style={styles.definitionBody}>{body}</Text>
                                            </Text>
                                            
                                            {dItem.example && (
                                                <Text style={styles.exampleText}>
                                                    {dItem.example}
                                                </Text>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>

                            {/* Synonyms Section */}
                            {synonyms && synonyms.length > 0 && (
                                <View style={styles.synonymsRow}>
                                    <Text style={styles.synonymLabel}>SYN. </Text>
                                    <Text style={styles.synonymText}>{synonyms.join(', ')}</Text>
                                </View>
                            )}
                        </View>
                    );
                })}

                {!isAggregated && onEditSelection && (
                    <TouchableOpacity style={styles.editSelectionButton} onPress={onEditSelection}>
                        <Text style={styles.editSelectionText}>Modifier la sélection</Text>
                    </TouchableOpacity>
                )}
            </View>
        </BlockWrapper>
    );
};

export const DefinitionBlock = React.memo(DefinitionBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.blockKey === nextProps.blockKey &&
        prevProps.isAggregated === nextProps.isAggregated &&
        prevProps.definitions.length === nextProps.definitions.length &&
        JSON.stringify(prevProps.definitions) === JSON.stringify(nextProps.definitions)
    );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        paddingVertical: 2,
    },
    fallbackText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 8
    },
    header: {
        flexDirection: 'row',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    termText: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.primary, // Using Quotex Blue instead of Pink
        letterSpacing: -0.5,
    },
    pronunciationText: {
        fontSize: 15,
        color: colors.textSecondary,
        fontWeight: '400',
    },
    genreText: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.text,
    },
    termSection: {
        marginBottom: 16,
    },
    termSectionSeparator: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.surfaceHighlight,
    },
    meaningsList: {
        gap: 8,
    },
    meaningRow: {
        marginBottom: 2,
    },
    definitionLine: {
        lineHeight: 22,
    },
    meaningNumber: {
        fontSize: 15,
        fontWeight: '900',
        color: colors.primary, // Using Quotex Blue
    },
    contextText: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.text,
    },
    definitionBody: {
        fontSize: 15,
        color: colors.text,
        lineHeight: 22,
    },
    exampleText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontStyle: 'italic',
        marginTop: 2,
        paddingLeft: 4,
    },
    synonymsRow: {
        flexDirection: 'row',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.surfaceHighlight,
    },
    synonymLabel: {
        fontSize: 13,
        fontWeight: '900',
        color: colors.primary, // Using Quotex Blue
    },
    synonymText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
    },
    // Button Styles
    emptyContainer: {
        position: 'relative',
        marginBottom: 10,
    },
    emptyBlockContainer: {
        backgroundColor: colors.primaryLight,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.primaryLight,
        borderStyle: 'dashed',
    },
    emptyBlockText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primary,
        marginTop: 12,
    },
    emptyBlockSubtext: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    removeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 14,
        padding: 6,
        zIndex: 10,
    },
    editSelectionButton: {
        alignItems: 'center',
        paddingVertical: 8,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 8,
        marginTop: 12,
    },
    editSelectionText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
});
