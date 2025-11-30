import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

interface ScanScreenProps {
  onNavigate: (screen: number) => void;
  currentScreen: number;
}

export default function ScanScreen({ onNavigate, currentScreen }: ScanScreenProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedText, setScannedText] = useState('');
  const scanAnimation = useRef(new Animated.Value(0)).current;

  const simulateScan = () => {
    setIsScanning(true);

    // Animation de scan
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

    // Simulation du résultat
    setTimeout(() => {
      setScannedText("The only way to do great work is to love what you do.");
      setIsScanning(false);
      scanAnimation.stopAnimation();
      scanAnimation.setValue(0);
    }, 2000);
  };

  const translateY = scanAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Quotex</Text>
        <Text style={styles.tagline}>Capture & Share Wisdom</Text>
      </View>

      {/* Scan Frame */}
      <View style={styles.scanArea}>
        <View style={styles.scanFrame}>
          {/* Corners */}
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />

          {/* Scan Line */}
          {isScanning && (
            <Animated.View
              style={[
                styles.scanLine,
                { transform: [{ translateY }] },
              ]}
            />
          )}

          {/* Instructions / Result */}
          <View style={styles.content}>
            {!scannedText ? (
              <>
                <Icon name="book-open" size={48} color="#4B5563" />
                <Text style={styles.instructionText}>
                  {isScanning ? 'Scan en cours...' : 'Placez une citation dans le cadre'}
                </Text>
              </>
            ) : (
              <Text style={styles.scannedText}>{scannedText}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Navigation Hints */}
      {currentScreen === 1 && (
        <>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonLeft]}
            onPress={() => onNavigate(0)}
          >
            <Icon name="chevron-left" size={24} color="#E5E7EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonRight]}
            onPress={() => onNavigate(2)}
          >
            <Icon name="chevron-right" size={24} color="#E5E7EB" />
          </TouchableOpacity>
        </>
      )}

      {/* Bottom Controls */}
      <View style={styles.controls}>
        {scannedText && !isScanning ? (
          // Save/Cancel buttons
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setScannedText('')}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Scan controls
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.iconButton}>
              <Icon name="image" size={24} color="#E5E7EB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scanButton, isScanning && styles.scanButtonActive]}
              onPress={simulateScan}
              disabled={isScanning}
            >
              <Icon
                name="camera"
                size={32}
                color={isScanning ? '#20B8CD' : '#20B8CD'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton}>
              <Icon name="zap" size={24} color="#E5E7EB" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Scanning Indicator */}
      {isScanning && (
        <View style={styles.scanningIndicator}>
          <View style={styles.scanningDot} />
          <Text style={styles.scanningText}>Scan en cours...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 32,
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
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
    paddingHorizontal: 32,
  },
  scanFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 400,
    borderWidth: 2,
    borderColor: 'rgba(32, 184, 205, 0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#20B8CD',
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 4,
    backgroundColor: '#20B8CD',
  },
  content: {
    alignItems: 'center',
    padding: 16,
  },
  instructionText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  scannedText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(26, 26, 26, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(42, 42, 42, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonLeft: {
    left: 16,
  },
  navButtonRight: {
    right: 16,
  },
  controls: {
    position: 'absolute',
    bottom: 80,
    width: '100%',
    paddingHorizontal: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(26, 26, 26, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(42, 42, 42, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(32, 184, 205, 0.1)',
    borderWidth: 2,
    borderColor: '#20B8CD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonActive: {
    backgroundColor: 'rgba(32, 184, 205, 0.2)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(26, 26, 26, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(42, 42, 42, 0.3)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#20B8CD',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0F0F0F',
    fontSize: 16,
  },
  scanningIndicator: {
    position: 'absolute',
    top: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(32, 184, 205, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.3)',
    borderRadius: 8,
  },
  scanningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#20B8CD',
  },
  scanningText: {
    fontSize: 14,
    color: '#20B8CD',
  },
});