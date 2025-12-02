import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Image,
} from 'react-native';
import FeatherIcon from 'react-native-vector-icons/Feather';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BookOpen, ChevronLeft, ChevronRight, ScanLine, ImageIcon, Zap, Book } from 'lucide-react-native';

// --- CORRECTION DU CHEMIN ICI ---
const quotexLogo = require('../assets/images/quotex_logo.png'); 

interface ScanScreenProps {
  onNavigate: (screen: number) => void;
  currentScreen: number;
}

export default function ScanScreen({ onNavigate, currentScreen }: ScanScreenProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedText, setScannedText] = useState('');
  
  const scanAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current; 

  // Animation de pulsation du bouton de scan (inchangée)
  useEffect(() => {
    if (!isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isScanning]);

  const pulseWide = pulseAnimation.interpolate({
    inputRange: [1, 1.1],
    outputRange: [1, 1.4], 
  });

  const simulateScan = () => {
    setIsScanning(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnimation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    setTimeout(() => {
      setScannedText("The only way to do great work is to love what you do.");
      setIsScanning(false);
      scanAnimation.stopAnimation();
      scanAnimation.setValue(0);
    }, 2000);
  };

  const translateY = scanAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 140],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
            {/* 💡 Calque Extérieur STATIQUE : lueur large et très subtile */}
            {/* Utilisation d'une View standard car il n'y a plus d'animation ici */}

            {/* --- CALQUE D'OMBRE / LUEUR DERRIÈRE LE LOGO --- */}

            {/* --- LE LOGO RESTE AU-DESSUS (zIndex: 10) --- */}
            <Image
              source={quotexLogo}
              style={styles.logoImage}
              resizeMode="contain"
              tintColor="#FFFFFF"
            />

            <Text style={styles.tagline}>Capture & Share Wisdom</Text>
        </View>
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
                { transform: [{ translateY }] },
              ]}
            />
          )}

          <View style={styles.content}>
            {!scannedText ? (
              <>
                <Book size={48} color="#4B5563" />
                <Text style={styles.instructionText}>
                  {isScanning ? 'Scan en cours...' : 'Placez une citation dans le cadre'}
                </Text>
              </>
            ) : (
              <View style={styles.resultContainer}>
                <Text style={styles.scannedText}>{scannedText}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Navigation Buttons */}
      {currentScreen === 1 && (
        <>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonLeft]}
            onPress={() => onNavigate(0)}
          >
            <ChevronLeft size={24} color="#E5E7EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonRight]}
            onPress={() => onNavigate(2)}
          >
            <ChevronRight size={24} color="#E5E7EB" />
          </TouchableOpacity>
        </>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {scannedText && !isScanning ? (
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
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.iconButton}>
              <ImageIcon size={24} color="#E5E7EB" />
            </TouchableOpacity>

            <View style={styles.scanButtonContainer}>
                <Animated.View 
                    style={[
                        styles.glowLayer,
                        styles.glowLayerOuter,
                        { transform: [{ scale: pulseWide }] }
                    ]} 
                />
                 <Animated.View 
                    style={[
                        styles.glowLayer,
                        styles.glowLayerInner,
                        { transform: [{ scale: pulseAnimation }] }
                    ]} 
                />
                
                <TouchableOpacity
                  style={[styles.scanButton, isScanning && styles.scanButtonActive]}
                  onPress={simulateScan}
                  disabled={isScanning}
                  activeOpacity={0.9}
                >
                  <ScanLine size={28} color={'#20B8CD'} />
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.iconButton}>
              <Zap size={24} color="#E5E7EB" />
            </TouchableOpacity>
          </View>
        )}
      </View>

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
    top: 60,
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 8, // espace supplémentaire pour laisser respirer l'ombre
    overflow: 'visible', // permettre à l'ombre de dépasser du container
  },
  
  // ------------------------------------------

// Style pour l'image
  logoImage: {
    width: 170,  
    height: 50,  
    marginBottom: 6,
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 10,
    overflow: 'visible',
  },


  tagline: {
    fontSize: 14,
    color: '#666',
    marginTop: 0,
    fontWeight: '500',
  },
  scanArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
    backgroundColor: 'rgba(20, 20, 20, 0.3)', 
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 32, 
    height: 32,
    borderColor: '#20B8CD',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 24,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 24,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 24,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 24,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#20B8CD',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  content: {
    alignItems: 'center',
    padding: 24,
    width: '100%',
  },
  instructionText: {
    fontSize: 15,
    color: '#555',
    marginTop: 20,
    textAlign: 'center',
  },
  resultContainer: {
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.3)',
  },
  scannedText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  controls: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    paddingHorizontal: 24,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  glowLayer: {
    position: 'absolute',
    width: 70, 
    height: 70,
    borderRadius: 35,
    backgroundColor: '#20B8CD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowLayerOuter: {
    opacity: 0.1, 
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40, 
  },
  glowLayerInner: {
    opacity: 0.15,
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20, 
  },
  scanButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0F0F0F', 
    borderWidth: 2,
    borderColor: '#20B8CD', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 10,
  },
  scanButtonActive: {
    backgroundColor: 'rgba(32, 184, 205, 0.2)',
    borderColor: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    marginRight: 12,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    marginLeft: 12,
    borderRadius: 14,
    backgroundColor: '#20B8CD',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0F0F0F',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scanningIndicator: {
    position: 'absolute',
    top: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1,
    borderColor: '#20B8CD',
    borderRadius: 20,
    zIndex: 20,
  },
  scanningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#20B8CD',
  },
  scanningText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
});