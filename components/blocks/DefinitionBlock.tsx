import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { BlockKey } from '../../src/config/blocks';
import { useTheme } from '../../src/contexts/ThemeContext';
import { ThemeColors } from '../../src/theme/theme';

interface Definition {
    term: string;
    genre: string;
    definition: string;
    example: string;
}

interface DefinitionBlockProps {
    blockKey?: BlockKey; // 'definition' or 'dictionary'
    definitions: Definition[];
    onEditSelection?: () => void; // For QuoteDetail
    onManageDictionary?: () => void; // For BookDetail
    isAggregated?: boolean; // True for BookDetail (Dictionnaire), False for QuoteDetail (Définition)
    onRemove?: () => void;
}

export const DefinitionBlock: React.FC<DefinitionBlockProps> = ({
    blockKey = 'definition',
    definitions,
    onEditSelection,
    onManageDictionary,
    isAggregated = false,
    onRemove
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const hasDefinitions = definitions && definitions.length > 0;

    if (!hasDefinitions) {
        // Empty state differs by context
        if (isAggregated) {
            // Book Context
            return (
                <BlockWrapper blockKey={blockKey} onRemove={onRemove}>
                    <TouchableOpacity onPress={onManageDictionary} disabled={!onManageDictionary}>
                        <Text style={styles.fallbackText}>
                            Aucune définition visible. Cliquez pour gérer.
                        </Text>
                    </TouchableOpacity>
                </BlockWrapper>
            );
        } else {
            // Quote Context
            return (
                <TouchableOpacity style={styles.emptyBlockContainer} onPress={onEditSelection}>
                    <BookOpen size={24} color={colors.primary} />
                    <Text style={styles.emptyBlockText}>Cliquez pour définir des mots</Text>
                    <Text style={styles.emptyBlockSubtext}>Sélectionner des mots de la citation pour afficher leur définition.</Text>
                </TouchableOpacity>
            );
        }
    }

    return (
        <BlockWrapper
            blockKey={blockKey}
            onRemove={onRemove}
            rightElement={
                // Edit button for QuoteDetail context inside the header? 
                // Original design had it at bottom. Let's keep it at bottom for Quote, but maybe header for Book?
                // Actually BookDetail opens a modal on click. 
                undefined
            }
        >
            <TouchableOpacity
                disabled={!onManageDictionary && !isAggregated}
                onPress={onManageDictionary}
                activeOpacity={onManageDictionary ? 0.7 : 1}
            >
                <View style={styles.definitionContent}>
                    {definitions.map((dItem, defIndex) => (
                        <View key={`${dItem.term}-${defIndex}`}>
                            <Text style={styles.definitionTerm}>{dItem.term}</Text>
                            <Text style={styles.definitionGenre}>{dItem.genre}</Text>
                            <Text style={styles.definitionDesc}>{dItem.definition}</Text>
                            {dItem.example ? (
                                <Text style={styles.definitionExample}>
                                    <Text style={styles.exampleLabel}>Ex : </Text>{dItem.example}
                                </Text>
                            ) : null}
                            {defIndex !== definitions.length - 1 && <View style={styles.definitionDivider} />}
                        </View>
                    ))}
                </View>
            </TouchableOpacity>

            {!isAggregated && onEditSelection && (
                <TouchableOpacity style={styles.editSelectionButton} onPress={onEditSelection}>
                    <Text style={styles.editSelectionText}>Modifier la sélection</Text>
                </TouchableOpacity>
            )}
        </BlockWrapper>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    fallbackText: {
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 8
    },
    // Empty State Styles
    emptyBlockContainer: {
        backgroundColor: colors.primaryLight,
        borderWidth: 1,
        borderColor: colors.primaryLight, // Using primaryLight alpha for border too or similar
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        borderStyle: 'dashed',
    },
    emptyBlockText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primary,
        marginTop: 12,
        marginBottom: 4,
    },
    emptyBlockSubtext: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 20,
    },

    // Content Styles
    definitionContent: {
        marginBottom: 8,
    },
    definitionTerm: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    definitionGenre: {
        fontSize: 12,
        color: colors.textTertiary,
        fontStyle: 'italic',
        marginBottom: 4,
    },
    definitionDesc: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: 4,
    },
    definitionExample: {
        fontSize: 13,
        color: colors.textTertiary,
        fontStyle: 'italic',
    },
    exampleLabel: {
        color: colors.primary,
    },
    definitionDivider: {
        height: 1,
        backgroundColor: colors.surfaceHighlight,
        marginVertical: 12,
    },
    editSelectionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 8,
        marginTop: 8,
    },
    editSelectionText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '500',
    },
});
