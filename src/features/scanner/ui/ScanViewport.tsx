import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BookOpen } from 'lucide-react-native';

import { ThemeColors, tokens } from '@/src/shared/theme';
import { AppText } from '@/src/shared/ui';
import ScanFrameOverlay from './ScanFrameOverlay';
import ScanMaskOverlay from './ScanMaskOverlay';

export interface ScanViewportProps {
  containerSize: { width: number; height: number };
  isTextDetectedLive: boolean;
  colors: ThemeColors;
  instructionText?: React.ReactNode;
  icon?: React.ReactNode;
  maskColor?: string;
  onScanFrameLayoutChange?: (layout: { x: number; y: number; width: number; height: number } | null) => void;
  onScanAreaYChange?: (y: number) => void;
}

export default function ScanViewport({
  containerSize,
  isTextDetectedLive,
  colors,
  instructionText,
  icon,
  maskColor = colors.backdrop,
  onScanFrameLayoutChange,
  onScanAreaYChange,
}: ScanViewportProps) {
  const [scanAreaY, setScanAreaY] = useState(0);
  const [scanFrameLayout, setScanFrameLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Fade animation for central instruction content when text is detected
  const fadeAnim = useSharedValue(1);

  useEffect(() => {
    fadeAnim.value = withTiming(isTextDetectedLive ? 0 : 1, { duration: 400 });
  }, [isTextDetectedLive, fadeAnim]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleScanAreaLayout = (event: any) => {
    const { y } = event.nativeEvent.layout;
    setScanAreaY(y);
    onScanAreaYChange?.(y);
  };

  const handleScanFrameLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    const layout = { x, y, width, height };
    setScanFrameLayout(layout);
    onScanFrameLayoutChange?.(layout);
  };

  return (
    <>
      <View style={styles.scanArea} onLayout={handleScanAreaLayout}>
        <View style={styles.scanFrame} onLayout={handleScanFrameLayout}>
          {scanFrameLayout && (
            <ScanFrameOverlay
              isTextDetectedLive={isTextDetectedLive}
              scanFrameLayout={scanFrameLayout}
              colors={colors}
            />
          )}

          <View style={styles.content}>
            <Animated.View
              style={[styles.fadeContainer, fadeStyle]}
              pointerEvents="none"
            >
              <View style={styles.iconShadowWrapper}>
                {icon ?? <BookOpen size={48} color={colors.text || '#FFFFFF'} />}
              </View>
              {instructionText && (
                <AppText style={styles.instructionTextShadow}>
                  {instructionText}
                </AppText>
              )}
            </Animated.View>
          </View>
        </View>
      </View>

      <ScanMaskOverlay
        containerSize={containerSize}
        scanFrameLayout={scanFrameLayout}
        scanAreaY={scanAreaY}
        maskColor={maskColor}
        borderRadius={24}
      />
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scanArea: {
      flex: 1,
      width: '100%',
      position: 'relative',
      zIndex: 3,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      marginTop: -160,
    },
    scanFrame: {
      width: '100%',
      aspectRatio: 3 / 4,
      maxHeight: 450,
      borderWidth: 1,
      borderColor: 'rgba(32, 184, 205, 0.2)',
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      overflow: 'visible',
      zIndex: 3,
    },
    content: {
      alignItems: 'center',
      padding: 24,
      width: '100%',
      overflow: 'visible',
    },
    fadeContainer: {
      alignItems: 'center',
      width: '100%',
    },
    instructionTextShadow: {
      fontSize: tokens.typography.fontSize.xl,
      color: '#FFFFFF',
      marginTop: 20,
      textAlign: 'center',
      textShadowColor: colors.primary,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 15,
      overflow: 'visible',
      fontFamily: tokens.typography.fontFamily.display,
    },
    iconShadowWrapper: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 15,
      elevation: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
