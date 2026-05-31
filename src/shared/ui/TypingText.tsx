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
    numberOfLines?: number;
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
    numberOfLines,
}) => {
    const [displayText, setDisplayText] = useState<string>(isCorrected && originalText ? originalText : text);
    const [showCursor, setShowCursor] = useState<boolean>(false);
    const [cursorVisible, setCursorVisible] = useState<boolean>(true);

    const prevTextRef = useRef<string>(text);
    const timersRef = useRef<{
        timeout?: NodeJS.Timeout;
        interval?: NodeJS.Timeout;
        blinkInterval?: NodeJS.Timeout;
    }>({});

    const clearAllTimers = () => {
        if (timersRef.current.timeout) clearTimeout(timersRef.current.timeout);
        if (timersRef.current.interval) clearInterval(timersRef.current.interval);
        if (timersRef.current.blinkInterval) clearInterval(timersRef.current.blinkInterval);
    };

    // Blinking cursor effect
    useEffect(() => {
        if (showCursor) {
            setCursorVisible(true);
            timersRef.current.blinkInterval = setInterval(() => {
                setCursorVisible(v => !v);
            }, 400); // Blink every 400ms
        } else {
            setCursorVisible(false);
            if (timersRef.current.blinkInterval) {
                clearInterval(timersRef.current.blinkInterval);
            }
        }
        return () => {
            if (timersRef.current.blinkInterval) {
                clearInterval(timersRef.current.blinkInterval);
            }
        };
    }, [showCursor]);

    useEffect(() => {
        const prevText = prevTextRef.current;
        prevTextRef.current = text; // Update ref for next render

        // Determine if we need to animate a correction
        let original: string | undefined = undefined;
        let shouldAnimate = false;

        if (isCorrected && originalText && originalText !== text) {
            original = originalText;
            shouldAnimate = true;
        } else if (prevText && prevText !== text) {
            // Automatic detection of real-time text updates
            original = prevText;
            shouldAnimate = true;
        }

        if (!shouldAnimate || !original) {
            setDisplayText(text);
            setShowCursor(false);
            return;
        }

        // Initialize animation state
        setDisplayText(original);
        setShowCursor(true);
        clearAllTimers();

        // 1. Initial pause: show original text with blinking cursor briefly
        timersRef.current.timeout = setTimeout(() => {
            let currentText = original;
            
            // 2. Backspace Phase: delete character by character
            timersRef.current.interval = setInterval(() => {
                if (currentText.length > 0) {
                    currentText = currentText.slice(0, -1);
                    setDisplayText(currentText);
                } else {
                    // Backspacing complete, clear interval
                    clearInterval(timersRef.current.interval);
                    
                    // 3. Pause at empty text
                    timersRef.current.timeout = setTimeout(() => {
                        let currentIndex = 0;
                        
                        // 4. Typing Phase: write new text letter by letter
                        timersRef.current.interval = setInterval(() => {
                            if (currentIndex <= text.length) {
                                setDisplayText(text.substring(0, currentIndex));
                                currentIndex++;
                            } else {
                                // Typing complete, clear interval
                                clearInterval(timersRef.current.interval);
                                
                                // 5. Final pause: keep cursor blinking for a moment, then hide it
                                timersRef.current.timeout = setTimeout(() => {
                                    setShowCursor(false);
                                }, 800);
                            }
                        }, 50); // Typing speed: 50ms per character
                    }, 250); // Pause on empty: 250ms
                }
            }, 30); // Backspace speed: 30ms per character
        }, 600); // Initial pause: 600ms

        return () => {
            clearAllTimers();
        };
    }, [isCorrected, text, originalText]);

    // Render plain text if not animating/corrected
    if (!showCursor) {
        return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
    }

    return (
        <Text style={style} numberOfLines={numberOfLines}>
            {displayText}
            {showCursor && (
                <Text style={[
                    styles.cursor, 
                    { opacity: cursorVisible ? 1 : 0 }
                ]}>
                    |
                </Text>
            )}
        </Text>
    );
};

const styles = StyleSheet.create({
    cursor: {
        fontWeight: 'bold',
        marginLeft: 1,
    },
});
