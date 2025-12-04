import React, { useState, useRef, useEffect } from 'react'; 
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Image,
  SafeAreaView,
  View,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { BookOpen, ChevronLeft, ChevronRight, ScanLine, ImageIcon, Sparkles, Book } from 'lucide-react-native';
import { useTabIndex } from '../TabNavigator';
import { addQuote, aiInterpretations, bookDescriptions, localQuotesDB } from '../data/staticData';
// --- CORRECTION DU CHEMIN ICI ---
const quotexLogo = require('../assets/images/quotex_logo.png'); 

interface ScanScreenProps {
  // onNavigate et currentScreen ne sont plus nécessaires ici
}

export default function ScanScreen({}: ScanScreenProps) {
  const navigation = useNavigation<any>();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedText, setScannedText] = useState('');
  const { tabIndex, setTabIndex } = useTabIndex();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) setTabIndex(1);
  }, [isFocused]);
  
  const scanAnimation = useRef(new Animated.Value(0)).current;

  // Pulsation removed: glow layers are now static

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

  const handleSaveQuote = () => {
    if (!scannedText) return;

    // Trouver le livre et l'auteur associés au texte scanné
    // NOTE: C'est une logique simplifiée pour la démo.
    // Dans une vraie app, l'IA ou l'utilisateur confirmerait ces informations.
    const bookTitle = Object.keys(bookDescriptions).find(title => 
      localQuotesDB.some(q => q.text === scannedText && q.book === title)
    ) || "Livre inconnu";

    const authorName = bookDescriptions[bookTitle]?.author || "Auteur inconnu";

    // Appelle la fonction qui simule l'ajout aux deux bases de données
    addQuote({ text: scannedText, book: bookTitle, author: authorName });
    setScannedText(''); // Réinitialise l'écran de scan
    navigation.navigate('MyQuotes'); // Navigue vers l'écran des citations locales
  };

  const translateY = scanAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 140],
  });

  return (
    <SafeAreaView style={styles.container}>
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
                <BookOpen size={48} color="#4B5563" />
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
      {isFocused && (
        <>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonLeft]}
            onPress={() => navigation.navigate('MyQuotes')}
          >
            <ChevronLeft size={24} color="#E5E7EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonRight]}
            onPress={() => navigation.navigate('Social')}
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
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSaveQuote}
            >
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.iconButton}>
              <ImageIcon size={24} color="#E5E7EB" />
            </TouchableOpacity>

            <View style={styles.scanButtonContainer}>

                
                <TouchableOpacity
                  style={[styles.scanButton, isScanning && styles.scanButtonActive]}
                  onPress={simulateScan}
                  disabled={isScanning}
                  activeOpacity={0.9}
                >
                  <View>
                    <View style={styles.scanInnerShadow} />
                    <ScanLine size={28} color={'#20B8CD'} />
                  </View>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.iconButton}>
              <Sparkles size={24} color="#E5E7EB" />
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
    </SafeAreaView>
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
    position: 'relative',
    top: 0,
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
    width: 170*0.8,  
    height: 50.8,  
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
    marginTop: -95,
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
    overflow: 'visible',
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
    top: -3,
    left: -3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 24,
  },
  cornerTopRight: {
    top: -3,
    right: -3,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 24,
  },
  cornerBottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 24,
  },
  cornerBottomRight: {
    bottom: -3,
    right: -3,
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
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonContainer: {
    width: 110,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scanButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'transparent', 
    borderWidth: 3,
    borderColor: '#20B8CD', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 10,
  },

  // inner filled circle inside the bordered ring


  // pseudo inner shadow to simulate inset depth
  scanInnerShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.28)'
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