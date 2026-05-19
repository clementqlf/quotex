// ScanWorkflow.tsx
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Trash2, ScanLine } from 'lucide-react-native';
import { PhotoFile } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import ScanPreviewModal from './ScanPreviewModal';
import * as Haptics from 'expo-haptics';
import { useScanWorkflow } from '../model/useScanWorkflow';

type ScanWorkflowProps = {
  photo: PhotoFile;
  ocrElements: TextElement[];
  ocrBlocks?: TextBlock[];
  onReset: () => void;
  isGallery?: boolean;
};

const ScanWorkflow: React.FC<ScanWorkflowProps> = ({ photo, ocrElements, ocrBlocks = [], onReset, isGallery }) => {
  const {
    viewportSize,
    setViewportSize,
    imageSize,
    setImageSize,
    getPhotoDims,
    animatedPhotoStyle,
    scannedText,
    selectionRange,
    setSelectionRange,
    selectionIndexes,
    isHighlightMode,
    setIsHighlightMode,
    wordsWithRects,
    copied,
    imagePanResponder,
    startPinPanResponder,
    endPinPanResponder,
    pinsGeometry,
    menuPosition,
    showPreviewModal,
    setShowPreviewModal,
    handleSaveQuote,
    handleConfirmSave,
    handleCopy,
    handleShare,
    handleSelectAll,
  } = useScanWorkflow({
    photo,
    ocrElements,
    ocrBlocks,
    onReset,
    isGallery,
  });

  return (
    <>
      <View
        style={styles.photoContainer}
        onLayout={event => {
          // --- CALCUL DE L'ÉCHELLE POUR LE RESIZEMODE="CONTAIN" ---
          const { width: containerWidth, height: containerHeight } = event.nativeEvent.layout;
          setViewportSize({ width: containerWidth, height: containerHeight });

          const { photoW, photoH } = getPhotoDims();

          const imageAspectRatio = photoW / photoH;
          const containerAspectRatio = containerWidth / containerHeight;

          let displayedWidth, displayedHeight, offsetX = 0, offsetY = 0;

          if (imageAspectRatio > containerAspectRatio) {
            displayedWidth = containerWidth;
            displayedHeight = containerWidth / imageAspectRatio;
            offsetY = (containerHeight - displayedHeight) / 2;
          } else {
            displayedHeight = containerHeight;
            displayedWidth = containerHeight * imageAspectRatio;
            offsetX = (containerWidth - displayedWidth) / 2;
          }

          setImageSize({ width: displayedWidth, height: displayedHeight, offsetX, offsetY });
        }}
      >
        <Animated.View style={[styles.photoContent, animatedPhotoStyle]}>
          <Image
            source={{ uri: `file://${photo.path}` }}
            style={styles.photo}
            resizeMode="contain"
          />

          {/* Subtly highlight detected text boxes in the background (Live Text mode) */}
          {isHighlightMode && wordsWithRects.map((w) => (
            <View
              key={`detect-${w.index}`}
              style={[
                styles.detectedHighlight,
                {
                  left: w.rect.left,
                  top: w.rect.top,
                  width: w.rect.width,
                  height: w.rect.height,
                  transform: [{ rotate: `${w.rect.rotation || 0}deg` }],
                }
              ]}
            />
          ))}

          {/* Draw selection highlights over the selected text */}
          {selectionRange && wordsWithRects
            .filter(w => w.index >= selectionIndexes.min && w.index <= selectionIndexes.max)
            .map((w) => (
              <View
                key={`select-${w.index}`}
                style={[
                  styles.selectionHighlight,
                  {
                    left: w.rect.left - 2,
                    top: w.rect.top - 2,
                    width: w.rect.width + 4,
                    height: w.rect.height + 4,
                    transform: [{ rotate: `${w.rect.rotation || 0}deg` }],
                  }
                ]}
              />
            ))}

          {/* Gesture overlay covers the image viewport exactly to receive touch events */}
          {imageSize.width > 0 && (
            <View
              {...imagePanResponder.panHandlers}
              style={[
                styles.gestureOverlay,
                {
                  left: imageSize.offsetX,
                  top: imageSize.offsetY,
                  width: imageSize.width,
                  height: imageSize.height,
                }
              ]}
            />
          )}

          {/* Selection Pins (Grabber Handles) */}
          {pinsGeometry && (
            <>
              {/* Start Handle */}
              <View
                {...startPinPanResponder.panHandlers}
                style={[
                  styles.grabberPin,
                  {
                    left: pinsGeometry.startPin.left,
                    top: pinsGeometry.startPin.top,
                    height: pinsGeometry.startPin.height,
                  }
                ]}
              >
                <View style={styles.grabberLine} />
                <View style={[styles.grabberKnob, { top: -10 }]} />
              </View>

              {/* End Handle */}
              <View
                {...endPinPanResponder.panHandlers}
                style={[
                  styles.grabberPin,
                  {
                    left: pinsGeometry.endPin.left,
                    top: pinsGeometry.endPin.top,
                    height: pinsGeometry.endPin.height,
                  }
                ]}
              >
                <View style={styles.grabberLine} />
                <View style={[styles.grabberKnob, { bottom: -10 }]} />
              </View>
            </>
          )}

          {/* Floating Context Action Menu */}
          {menuPosition && (
            <View
              style={[
                styles.contextMenu,
                {
                  left: menuPosition.left,
                  top: menuPosition.top,
                }
              ]}
            >
              <TouchableOpacity style={styles.menuButton} onPress={handleCopy}>
                <Text style={styles.menuButtonText}>{copied ? 'Copié !' : 'Copier'}</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparator} />
              <TouchableOpacity style={styles.menuButton} onPress={handleSaveQuote}>
                <Text style={styles.menuButtonText}>Enregistrer</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparator} />
              <TouchableOpacity style={styles.menuButton} onPress={handleShare}>
                <Text style={styles.menuButtonText}>Partager</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparator} />
              <TouchableOpacity style={styles.menuButton} onPress={handleSelectAll}>
                <Text style={styles.menuButtonText}>Tout</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Apple Photos style Live Text Toggle Icon in the bottom right corner */}
          {wordsWithRects.length > 0 && imageSize.width > 0 && (
            <TouchableOpacity
              style={[
                styles.liveTextButton,
                isHighlightMode && styles.liveTextButtonActive
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsHighlightMode(!isHighlightMode);
              }}
            >
              <ScanLine size={22} color={isHighlightMode ? '#0F0F0F' : '#E5E7EB'} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* --- UI PAR DESSUS --- */}
      <View style={styles.resultInfoContainer}>
        <Text style={styles.instructionText}>
          {scannedText ? 'Sélection prête !' : 'Restez appuyé sur le texte pour le sélectionner'}
        </Text>
      </View>

      {/* Carte flottante premium de prévisualisation en direct */}
      {scannedText ? (
        <View style={styles.livePreviewCard}>
          <Text style={styles.livePreviewHeader}>Texte sélectionné :</Text>
          <Text style={styles.livePreviewText} numberOfLines={3} ellipsizeMode="tail">
            {scannedText}
          </Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onReset}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trashButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectionRange(null);
            }}
          >
            <Trash2 size={20} color="#E5E7EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, !scannedText && styles.saveButtonDisabled]}
            onPress={handleSaveQuote}
            disabled={!scannedText}
          >
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScanPreviewModal
        visible={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handleConfirmSave}
        scannedText={scannedText}
      />
    </>
  );
};

const styles = StyleSheet.create({
  photoContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  photoContent: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  detectedHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    zIndex: 1,
  },
  selectionHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(32, 184, 205, 0.35)', // Cyan blue translucent highlight
    borderRadius: 4,
    zIndex: 2,
  },
  gestureOverlay: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  grabberPin: {
    position: 'absolute',
    width: 24,
    marginLeft: -12, // Offset to center the line in touch targets
    zIndex: 15,
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
  },
  grabberLine: {
    width: 2.5,
    height: '100%',
    backgroundColor: '#20B8CD',
  },
  grabberKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#20B8CD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  contextMenu: {
    position: 'absolute',
    width: 260,
    height: 40,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 100,
  },
  menuButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  menuSeparator: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  liveTextButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 6,
    zIndex: 20,
  },
  liveTextButtonActive: {
    backgroundColor: '#20B8CD',
    borderColor: '#20B8CD',
  },
  resultInfoContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.5)',
    zIndex: 100,
  },
  instructionText: {
    fontSize: 15,
    color: '#20B8CD',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    paddingHorizontal: 24,
    zIndex: 120,
  },
  livePreviewCard: {
    position: 'absolute',
    bottom: 125,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderColor: 'rgba(32, 184, 205, 0.6)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 110,
  },
  livePreviewHeader: {
    color: '#20B8CD',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  livePreviewText: {
    color: '#E5E7EB',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    marginRight: 8,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
  },
  trashButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    marginLeft: 8,
    borderRadius: 14,
    backgroundColor: '#20B8CD',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#1a1a1a',
    borderColor: '#2A2A2A',
  },
  saveButtonText: {
    color: '#0F0F0F',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ScanWorkflow;