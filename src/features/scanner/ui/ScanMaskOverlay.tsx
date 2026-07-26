import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

export interface ScanMaskOverlayProps {
  containerSize: { width: number; height: number };
  scanFrameLayout: { x: number; y: number; width: number; height: number } | null;
  scanAreaY: number;
  maskColor?: string;
  borderRadius?: number;
}

export default function ScanMaskOverlay({
  containerSize,
  scanFrameLayout,
  scanAreaY,
  maskColor = 'rgba(0, 0, 0, 0.6)',
  borderRadius = 24,
}: ScanMaskOverlayProps) {
  if (!scanFrameLayout || containerSize.width <= 0 || containerSize.height <= 0) {
    return null;
  }

  const maskId = 'scanMask';

  return (
    <Svg
      width={containerSize.width}
      height={containerSize.height}
      style={styles.darkOverlay}
      viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
      pointerEvents="none"
    >
      <Defs>
        <Mask id={maskId}>
          <Rect width={containerSize.width} height={containerSize.height} fill="white" />
          <Rect
            x={scanFrameLayout.x}
            y={scanAreaY + scanFrameLayout.y}
            width={scanFrameLayout.width}
            height={scanFrameLayout.height}
            rx={borderRadius}
            ry={borderRadius}
            fill="black"
          />
        </Mask>
      </Defs>
      <Rect
        width={containerSize.width}
        height={containerSize.height}
        fill={maskColor}
        mask={`url(#${maskId})`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  darkOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
});
