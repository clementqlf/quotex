import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Trash2 } from 'lucide-react-native';
import { PhotoFile } from 'react-native-vision-camera';
import { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { useData } from '../src/contexts/DataProvider';
import ScanPreviewModal from '../components/ScanPreviewModal';
import { useScanSelection } from '../src/hooks/useScanSelection';
import { getBlockRectOnScreen, getPhotoOrientation, MLKitText } from '../src/utils/scanGeometry';

type ScanWorkflowProps = {
  photo: PhotoFile;
  ocrResult: TextRecognitionResult;
  onReset: () => void;
};

const ScanWorkflow: React.FC<ScanWorkflowProps> = ({ photo, ocrResult, onReset }) => {
  console.log('ScanWorkflow: Mounting with photo path:', photo.path);
  console.log('ScanWorkflow: OCR blocks count:', ocrResult?.blocks?.length);

  const navigation = useNavigation<any>();
  const { addQuote } = useData();
  const [photoDimensions, setPhotoDimensions] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const previewScale = useRef(new Animated.Value(1)).current;
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDebugAngles, setShowDebugAngles] = useState(false);

  useEffect(() => {
    const uri = `file://${photo.path}`;
    Image.getSize(
      uri,
      (width, height) => setPhotoDimensions({ width, height }),
      () => setPhotoDimensions({ width: photo.width || 0, height: photo.height || 0 }),
    );
  }, [photo]);

  // Use the new hook
  const {
    wordBlocks,
    selectedBlocks,
    setSelectedBlocks,
    scannedText,
    setScannedText,
    panResponder,
    getBlockKey
  } = useScanSelection(photo, ocrResult, imageSize, photoDimensions);


  useEffect(() => {
    Animated.spring(previewScale, {
      toValue: photo && ocrResult ? 1.4 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [photo, ocrResult, previewScale]);


  const getPhotoDims = () => {
    const photoW = photo?.width || photoDimensions.width || 1;
    const photoH = photo?.height || photoDimensions.height || 1;
    return { photoW, photoH };
  };

  const handleSaveQuote = () => {
    if (!scannedText) return;
    setShowPreviewModal(true);
  };

  const handleConfirmSave = async (quote: string, book: string, author: string) => {
    await addQuote(quote, book, author);

    setShowPreviewModal(false);
    setScannedText('');
    setSelectedBlocks([]);

    navigation.navigate('MyQuotes');
    onReset();
  };

  const orientation = useMemo(() => getPhotoOrientation(photo), [photo]);

  return (
    <>
      <View
        style={styles.photoContainer}
        onLayout={event => {
          const { width: containerWidth, height: containerHeight } = event.nativeEvent.layout;
          setViewportSize({ width: containerWidth, height: containerHeight });

          const orient = getPhotoOrientation(photo);
          const { photoW, photoH } = getPhotoDims();
          const orientedWidth = orient === 90 || orient === 270 ? photoH : photoW;
          const orientedHeight = orient === 90 || orient === 270 ? photoW : photoH;

          const imageAspectRatio = orientedHeight > 0 ? orientedWidth / orientedHeight : 1;
          const containerAspectRatio = containerHeight > 0 ? containerWidth / containerHeight : 1;

          let displayedWidth;
          let displayedHeight;
          let offsetX = 0;
          let offsetY = 0;

          if (imageAspectRatio > containerAspectRatio) {
            displayedWidth = containerWidth;
            displayedHeight = containerWidth / imageAspectRatio;
            offsetY = (containerHeight - displayedHeight) / 2;
          } else {
            displayedHeight = containerHeight;
            displayedWidth = containerHeight * imageAspectRatio;
            offsetX = (containerWidth - displayedWidth) / 2;
          }

          setImageSize({
            width: displayedWidth,
            height: displayedHeight,
            offsetX,
            offsetY,
          });
        }}
      >
        <Animated.View style={[styles.photoContent, { transform: [{ scale: previewScale }] }]}>
          <Image
            source={{ uri: `file://${photo.path}` }}
            style={styles.photo}
            resizeMode="contain"
          />
          <View style={styles.blocksOverlay} {...panResponder.panHandlers}>
            {imageSize.width > 0 && wordBlocks.map((block, index) => {
              const rect = getBlockRectOnScreen(block, imageSize, { width: photo.width, height: photo.height }, orientation);
              if (!rect) return null;

              const isSelected = selectedBlocks.some(b => getBlockKey(b) === getBlockKey(block));

              return (
                <View
                  key={`${block.text}-${index}-${rect.left}`}
                  style={[
                    styles.textBlock,
                    {
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                      transform: rect.rotation ? [{ rotate: `${rect.rotation}deg` }] : undefined,
                    },
                    isSelected && styles.textBlockSelected,
                  ]}
                  pointerEvents="none"
                >
                  {showDebugAngles && rect.rotation ? (
                    <Text style={styles.blockDebugText}>{rect.rotation.toFixed(1)}°</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Animated.View>
      </View>

      <View style={styles.resultInfoContainer}>
        <View style={styles.resultInfoHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.blocksInfo}>
              {wordBlocks.length} bloc(s) détecté(s)
              {selectedBlocks.length > 0 && ` • ${selectedBlocks.length} sélectionné(s)`}
            </Text>
            {showDebugAngles && selectedBlocks.length > 0 && selectedBlocks.some(b => b.rotation) && (
              <Text style={styles.blocksInfo}>
                Angles: {selectedBlocks
                  .filter(b => b.rotation !== undefined)
                  .map(b => `${b.rotation?.toFixed(1)}°`)
                  .join(', ')}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => setShowDebugAngles(prev => !prev)}
          >
            <Text style={{ fontSize: 14 }}>🐛</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.instructionText}>
          {selectedBlocks.length > 0
            ? 'Sélection prête, enregistrez la citation'
            : 'Glissez votre doigt pour sélectionner la citation'}
        </Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onReset}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trashButton}
            onPress={() => {
              setSelectedBlocks([]);
              setScannedText('');
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
  },
  blocksOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-only',
  },
  textBlock: {
    position: 'absolute',
    backgroundColor: 'rgba(32, 184, 205, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
    pointerEvents: 'none',
    borderRadius: 4,
  },
  textBlockSelected: {
    backgroundColor: 'rgba(0, 255, 0, 0.5)',
  },
  blockDebugText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultInfoContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.5)',
    zIndex: 100,
  },
  resultInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  blocksInfo: {
    color: '#20B8CD',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'left',
  },
  debugButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
  instructionText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    paddingHorizontal: 24,
    zIndex: 120,
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
