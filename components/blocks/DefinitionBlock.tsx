import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { BlockWrapper } from './BlockWrapper';
import { BlockKey } from '../../src/config/blocks';

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
                    <BookOpen size={24} color="#20B8CD" />
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

const styles = StyleSheet.create({
    fallbackText: {
        color: '#9CA3AF',
        fontStyle: 'italic',
        marginTop: 8
    },
    // Empty State Styles
    emptyBlockContainer: {
        backgroundColor: 'rgba(32, 184, 205, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(32, 184, 205, 0.2)',
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
        color: '#20B8CD',
        marginTop: 12,
        marginBottom: 4,
    },
    emptyBlockSubtext: {
        fontSize: 13,
        color: '#6B7280',
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
        color: '#FFFFFF',
        marginBottom: 2,
    },
    definitionGenre: {
        fontSize: 12,
        color: '#9CA3AF',
        fontStyle: 'italic',
        marginBottom: 4,
    },
    definitionDesc: {
        fontSize: 14,
        color: '#D1D5DB',
        lineHeight: 20,
        marginBottom: 4,
    },
    definitionExample: {
        fontSize: 13,
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    exampleLabel: {
        color: '#20B8CD',
    },
    definitionDivider: {
        height: 1,
        backgroundColor: '#2A2A2A',
        marginVertical: 12,
    },
    editSelectionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        backgroundColor: '#2A2A2A',
        borderRadius: 8,
        marginTop: 8,
    },
    editSelectionText: {
        color: '#E5E7EB',
        fontSize: 12,
        fontWeight: '500',
    },
});
