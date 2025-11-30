import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';

export default function ScanScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const scanAnimation = new Animated.Value(0);

  const handleScan = () => {
    setIsScanning(true);
    
    // Simulate scanning animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Simulate scan completion
    setTimeout(() => {
      setIsScanning(false);
      scanAnimation.stopAnimation();
      scanAnimation.setValue(0);
      console.log('Scan completed!');
      // TODO: Navigate to quote edit screen
    }, 4000);
  };

  const translateY = scanAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Quotex</Text>
        <Text style={styles.tagline}>Capture & Share Wisdom</Text>
      </View>

      <View style={styles.scanArea}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />

          {isScanning && (
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [{ translateY }],
                },
              ]}
            />
          )}

          <View style={styles.scanPlaceholder}>
            <Text style={styles.scanPlaceholderIcon}>📖</Text>
            <Text style={styles.scanPlaceholderText}>
              {isScanning ? 'Scanning...' : 'Position your book here'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonActive]}
          onPress={handleScan}
          disabled={isScanning}
        >
          <View style={styles.scanButtonInner}>
            <Text style={styles.scanButtonIcon}>
              {isScanning ? '⏸' : '📷'}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.instruction}>
          {isScanning ? 'Hold steady...' : 'Tap to scan a quote'}
        </Text>

        <View style={styles.tips}>
          <Text style={styles.tipText}>💡 Tips:</Text>
          <Text style={styles.tipItem}>• Good lighting improves accuracy</Text>
          <Text style={styles.tipItem}>• Center the text in the frame</Text>
          <Text style={styles.tipItem}>• Keep the camera steady</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>47</Text>
          <Text style={styles.statLabel}>Scanned</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>12</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>98%</Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#20B8CD',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#888888',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  scanFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 400,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#20B8CD',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#20B8CD',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  scanPlaceholder: {
    alignItems: 'center',
  },
  scanPlaceholderIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  scanPlaceholderText: {
    fontSize: 16,
    color: '#666666',
  },
  controls: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  scanButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#20B8CD',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scanButtonActive: {
    backgroundColor: '#FF6B9D',
    shadowColor: '#FF6B9D',
  },
  scanButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#20B8CD',
  },
  scanButtonIcon: {
    fontSize: 32,
  },
  instruction: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 16,
    fontWeight: '500',
  },
  tips: {
    marginTop: 24,
    paddingHorizontal: 32,
  },
  tipText: {
    fontSize: 14,
    color: '#20B8CD',
    fontWeight: '600',
    marginBottom: 8,
  },
  tipItem: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 4,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#20B8CD',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2A2A2A',
  },
});