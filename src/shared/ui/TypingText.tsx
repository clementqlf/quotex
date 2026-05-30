import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, TextStyle, ViewStyle, View, Animated } from 'react-native';
import { colors } from '../theme';

interface TypingTextProps {
    text: string;
    originalText?: string;
    isCorrected?: boolean;
    duration?: number;
    style?: TextStyle | TextStyle[];
    containerStyle?: ViewStyle;
    highlightColor?: string;
}

/**
 * Component that animates text with a typing effect when corrected
 * Shows: original text -> backspaces -> types new text
 */
export const TypingText: React.FC<TypingTextProps> = ({
    text,
    originalText,
    isCorrected = false,
    duration = 1000,
    style,
    containerStyle,
    highlightColor = colors.dark.primary,
}) => {
    const [displayText, setDisplayText] = useState<string>(text);
    const [isHighlighted, setIsHighlighted] = useState<boolean>(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Trigger animation when corrected
    useEffect(() => {
        if (isCorrected && originalText && originalText !== text) {
            // Sequence: highlight -> typing animation
            
            // Step 1: Highlight the old text briefly
            setDisplayText(originalText);
            setIsHighlighted(true);
            
            const highlightTimer = setTimeout(() => {
                setIsHighlighted(false);
                setDisplayText(''); // Clear text
                
                // Step 2: Typing animation
                let currentIndex = 0;
                const charDelay = duration / (text.length + 5);
                
                const typeInterval = setInterval(() => {
                    if (currentIndex <= text.length) {
                        setDisplayText(text.substring(0, currentIndex));
                        currentIndex++;
                    } else {
                        clearInterval(typeInterval);
                    }
                }, charDelay);
                
                // Cleanup
                return () => {
                    clearInterval(typeInterval);
                    clearTimeout(highlightTimer);
                };
            }, 300); // Highlight duration
            
            return () => {
                clearTimeout(highlightTimer);
            };
        }
    }, [isCorrected, text, originalText, duration]);

    // If not corrected, just show normal text
    if (!isCorrected || !originalText || originalText === text) {
        return (
            <Text style={style}>{text}</Text>
        );
    }

    // If highlighted, show with background
    if (isHighlighted) {
        return (
            <View style={[styles.highlightContainer, { backgroundColor: highlightColor + '30' }, containerStyle]}>
                <Text style={[style, styles.highlightText]}>{displayText}</Text>
            </View>
        );
    }

    // Otherwise show typing text
    return (
        <Text style={style}>
            {displayText}
            {displayText.length < text.length && <Text style={styles.cursor}>|</Text>}
        </Text>
    );
};

const styles = StyleSheet.create({
    highlightContainer: {
        borderRadius: 4,
        paddingHorizontal: 2,
        paddingVertical: 1,
    },
    highlightText: {
        // Can override with style prop
    },
    cursor: {
        color: colors.dark.primary,
        fontWeight: 'bold',
    },
});
