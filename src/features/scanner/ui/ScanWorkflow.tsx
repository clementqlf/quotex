import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Trash2, Bug, Eraser } from 'lucide-react-native';
import { PhotoFile } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import ScanPreviewModal from './ScanPreviewModal';
import { useScanWorkflow } from '../model/useScanWorkflow';

type ScanWorkflowProps = {
  photo: PhotoFile;
  ocrElements: TextElement[];
  ocrBlocks?: TextBlock[];
  onReset: () => void;
  isGallery?: boolean;
};

const ScanWorkflow: React.FC<ScanWorkflowProps> = (props) => {
  const {
    isDevMode,
    setIsDevMode,
    debugTouch,
    setViewportSize,
    imageDisplayInfo,
    words,
    selectionRange,
    scannedText,
    copied,
    showPreviewModal,
    setShowPreviewModal,
    imagePanResponder,
    startPinResponder,
    endPinResponder,
    pinsGeometry,
    handleClearSelection,
    handleCopy,
    handleSaveQuote,
    handleConfirmSave,
    handleSelectAll,
    onReset,
    isEraserMode,
    setIsEraserMode,
    excludedIndices,
  } = useScanWorkflow(props);

  return (
    <>
      <View
        style={styles.photoContainer}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          setViewportSize({ width, height });
        }}
      >
        <View 
          style={[styles.photoContent, { width: imageDisplayInfo.width, height: imageDisplayInfo.height }]}
        >
          <Image
            source={{ uri: `file://${props.photo.path}` }}
            style={{ width: '100%', height: '100%', opacity: isDevMode ? 0.4 : 0.9 }}
            resizeMode="contain"
          />

          {/* 1. Gesture overlay covers exactly the displayed image area to receive background touches */}
          <View
            {...imagePanResponder.panHandlers}
            style={StyleSheet.absoluteFillObject}
          />

          {/* 2. Highlights and boxes (pointerEvents="none" to not block touches) */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {/* Dev Mode: All words bounding boxes & reading order */}
            {isDevMode && words.map((w) => (
              <View
                key={`dev-word-${w.index}`}
                style={{
                  position: 'absolute',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 0, 0, 0.7)',
                  left: w.scaledFrame.left,
                  top: w.scaledFrame.top,
                  width: w.scaledFrame.width,
                  height: w.scaledFrame.height,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 9, color: 'white', fontWeight: 'bold', backgroundColor: 'rgba(255,0,0,0.5)', padding: 1 }}>{w.index}</Text>
              </View>
            ))}

            {/* Selection Highlight */}
            {selectionRange && words
              .filter(w => w.index >= selectionRange.start && w.index <= selectionRange.end)
              .map((w) => {
                const isExcluded = excludedIndices.has(w.index);
                if (isExcluded) {
                  if (isEraserMode) {
                    return (
                      <View
                        key={`select-${w.index}`}
                        style={[
                          styles.excludedHighlight,
                          {
                            left: w.scaledFrame.left,
                            top: w.scaledFrame.top,
                            width: w.scaledFrame.width,
                            height: w.scaledFrame.height,
                          }
                        ]}
                      />
                    );
                  }
                  return null;
                }
                return (
                  <View
                    key={`select-${w.index}`}
                    style={[
                      styles.selectionHighlight,
                      {
                        left: w.scaledFrame.left,
                        top: w.scaledFrame.top,
                        width: w.scaledFrame.width,
                        height: w.scaledFrame.height,
                      }
                    ]}
                  />
                );
              })}

            {/* Dev Mode debug touch point */}
            {isDevMode && debugTouch && (
              <View
                style={{
                  position: 'absolute',
                  left: debugTouch.x - 10,
                  top: debugTouch.y - 10,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: 'rgba(0, 255, 0, 0.6)',
                  borderWidth: 2,
                  borderColor: '#0f0',
                }}
              />
            )}
          </View>

          {/* 3. Pins (They must be outside the background GestureOverlay to receive their own touches) */}
          {/* Start Pin */}
          {pinsGeometry && (
            <View
              {...startPinResponder.panHandlers}
              pointerEvents={isEraserMode ? 'none' : 'auto'}
              style={[
                styles.grabberPin,
                isDevMode && styles.devGrabberPin,
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
          )}

          {/* End Pin */}
          {pinsGeometry && (
            <View
              {...endPinResponder.panHandlers}
              pointerEvents={isEraserMode ? 'none' : 'auto'}
              style={[
                styles.grabberPin,
                isDevMode && styles.devGrabberPin,
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
          )}
        </View>
      </View>

      {/* --- Dev Mode Overlay --- */}
      {isDevMode && (
        <View style={styles.devOverlay}>
          <Text style={styles.devText}>=== DEV MODE ===</Text>
          <Text style={styles.devText}>Photo: {props.photo.width}x{props.photo.height}</Text>
          <Text style={styles.devText}>Scale: {imageDisplayInfo.scale.toFixed(3)}</Text>
          <Text style={styles.devText}>Touch: {debugTouch ? `${Math.round(debugTouch.x)}, ${Math.round(debugTouch.y)}` : 'None'}</Text>
          <Text style={styles.devText}>Selection: {selectionRange ? `[${selectionRange.start}, ${selectionRange.end}]` : 'None'}</Text>
          <Text style={styles.devText}>Words Total: {words.length}</Text>
        </View>
      )}

      {/* Dev Mode Toggle Button */}
      <TouchableOpacity
        style={styles.devToggleButton}
        onPress={() => setIsDevMode(!isDevMode)}
      >
        <Bug size={24} color={isDevMode ? '#0f0' : '#666'} />
      </TouchableOpacity>

      {/* Basic Prod UI */}
      {!isDevMode && (
        <View style={styles.resultInfoContainer}>
          <Text style={styles.instructionText}>
            {isEraserMode 
              ? "Touchez un mot sélectionné pour l'enlever" 
              : scannedText 
                ? 'Ajustez avec les poignées' 
                : 'Appuyez sur un mot pour sélectionner'}
          </Text>
        </View>
      )}

      {scannedText && !isDevMode ? (
        <View style={styles.livePreviewCard}>
          <Text style={styles.livePreviewHeader}>Texte sélectionné :</Text>
          <Text style={styles.livePreviewText} numberOfLines={3} ellipsizeMode="tail">
            {scannedText}
          </Text>
          <View style={styles.miniActionBar}>
             <TouchableOpacity onPress={handleCopy}><Text style={styles.actionText}>{copied ? 'Copié' : 'Copier'}</Text></TouchableOpacity>
             <View style={styles.separator} />
             <TouchableOpacity onPress={handleSelectAll}><Text style={styles.actionText}>Tout Sélectionner</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onReset}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trashButton}
            onPress={handleClearSelection}
          >
            <Trash2 size={20} color="#E5E7EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.eraserButton,
              isEraserMode && styles.eraserButtonActive,
              !selectionRange && styles.eraserButtonDisabled
            ]}
            onPress={() => setIsEraserMode(!isEraserMode)}
            disabled={!selectionRange}
          >
            <Eraser size={20} color={isEraserMode ? '#0F0F0F' : '#E5E7EB'} />
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
  },
  photoContent: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(32, 184, 205, 0.4)',
    borderRadius: 2,
    zIndex: 2,
  },
  excludedHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.6)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 2,
    zIndex: 2,
  },
  grabberPin: {
    position: 'absolute',
    width: 32,
    marginLeft: -16, 
    zIndex: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devGrabberPin: {
    backgroundColor: 'rgba(255, 100, 100, 0.4)',
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
  miniActionBar: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionText: {
    color: '#20B8CD',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 15,
  },
  separator: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 15,
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
  eraserButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  eraserButtonActive: {
    backgroundColor: '#20B8CD',
  },
  eraserButtonDisabled: {
    opacity: 0.5,
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
  devOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f0',
    zIndex: 200,
    pointerEvents: 'none',
  },
  devText: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 6,
  },
  devToggleButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    borderWidth: 1,
    borderColor: '#0f0',
  },
});

export default ScanWorkflow;