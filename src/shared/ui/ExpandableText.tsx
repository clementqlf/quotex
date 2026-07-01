import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, NativeSyntheticEvent, TextLayoutEventData, TextStyle } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';

interface ExpandableTextProps {
    text: string;
    maxLines?: number;
    style?: TextStyle | TextStyle[];
}

const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const ExpandableText: React.FC<ExpandableTextProps> = ({ text, maxLines = 10, style }) => {
    const { colors } = useTheme();
    const [isMeasured, setIsMeasured] = useState(isTestEnv);
    const [showMoreButton, setShowMoreButton] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [prevText, setPrevText] = useState(text);

    if (text !== prevText) {
        setPrevText(text);
        setIsMeasured(isTestEnv);
        setShowMoreButton(false);
        setIsExpanded(false);
    }

    const onTextLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
        if (!isMeasured) {
            if (e.nativeEvent.lines.length > maxLines) {
                setShowMoreButton(true);
            }
            setIsMeasured(true);
        }
    }, [isMeasured, maxLines]);

    return (
        <View pointerEvents="box-none">
            {!isMeasured && (
                <Text
                    style={[style, { position: 'absolute', opacity: 0, left: 0, right: 0 }]}
                    onTextLayout={onTextLayout}
                >
                    {text}
                </Text>
            )}
            <Text
                style={style}
                numberOfLines={isMeasured && !isExpanded ? maxLines : undefined}
            >
                {text}
            </Text>
            {showMoreButton && (
                <TouchableOpacity
                    style={styles.showMoreButton}
                    onPress={() => setIsExpanded(!isExpanded)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.showMoreText, { color: colors.primary }]}>
                        {isExpanded ? 'Voir moins' : 'Voir plus'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    showMoreButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    showMoreText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
