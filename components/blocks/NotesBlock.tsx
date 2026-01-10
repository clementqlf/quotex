import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { BlockWrapper } from './BlockWrapper';
import { BlockKey } from '../../src/config/blocks';

interface NotesBlockProps {
    blockKey?: BlockKey;
    content: string;
    onUpdate: (text: string) => void;
    placeholder?: string;
    isEditable?: boolean; // Could be used to disable editing
    onRemove?: () => void;
}

export const NotesBlock: React.FC<NotesBlockProps> = ({
    blockKey = 'notes',
    content,
    onUpdate,
    placeholder = "Écrire des notes...",
    isEditable = true,
    onRemove
}) => {
    return (
        <BlockWrapper blockKey={blockKey} onRemove={onRemove}>
            <TextInput
                style={styles.notesInput}
                placeholder={placeholder}
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={6}
                value={content}
                onChangeText={onUpdate}
                textAlignVertical="top"
                editable={isEditable}
            />
        </BlockWrapper>
    );
};

const styles = StyleSheet.create({
    notesInput: {
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        padding: 12,
        color: '#E5E7EB',
        fontSize: 14,
        minHeight: 100,
    },
});
