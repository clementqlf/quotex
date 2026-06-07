import { useState, useRef, useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { PhotoFile, useCameraDevice, useCameraPermission, useCodeScanner, useCameraFormat } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import { useRouter } from 'expo-router';
import { Camera } from 'react-native-vision-camera';
import * as ExpoImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { scanService, IsbnBookData } from '../api/ScanService';
import { quoteService } from '@/src/features/quote/api/QuoteService';
import { Quote, User } from '@/src/shared/api/types';
import { useAuth } from '@/src/app/providers/AuthContext';
import { PlatformServices } from '@/src/shared/platform';
import { getBookTitle, getAuthorName } from '@/src/shared/lib/dataHelpers';
import { OcrResult } from '../api/ScanService';

// Interface pour l'injection de dépendances de navigation
export interface ITabController {
  setTabIndex: (index: number) => void;
  setSwipeEnabled: (enabled: boolean) => void;
}


/**
 * Props pour le hook useScanController
 */
export interface UseScanControllerProps {
  isFocused: boolean;
  containerSize: { width: number; height: number };
  scanFrameLayout: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  scanAreaY: number;
  // Injection de dépendances pour découpler de l'implémentation UI
  tabController?: ITabController;
  quotes?: Quote[];
  currentUser?: User | null;
}

/**
 * État de la caméra et du scan
 */
export interface ScanControllerState {
  // Camera state
  hasPermission: boolean;
  device: any;
  format: any;
  cameraRef: React.RefObject<Camera | null>;
  
  // Scan state
  photo: PhotoFile | null;
  ocrElements: TextElement[] | null;
  ocrBlocks: TextBlock[] | null;
  ocrNormalizedSize: { width: number; height: number } | null;
  isFromGallery: boolean;
  isLoading: boolean;
  isPickerActive: boolean;
  
  // ISBN state
  showIsbnPopup: boolean;
  isbnBookData: IsbnBookData | null;
  isSearchingIsbn: boolean;
  
  // Random quote state
  randomQuote: any | null;
  showRandomQuoteModal: boolean;
  setShowRandomQuoteModal: (value: boolean) => void;
  
  // OCR Live state
  isTextDetectedLive: boolean;
  
  // Lock state
  scanLockRef: React.MutableRefObject<boolean>;
  isSearchingIsbnRef: React.MutableRefObject<boolean>;
}

/**
 * Actions et handlers
 */
export interface ScanControllerActions {
  // Camera actions
  requestPermission: () => void;
  
  // Scan actions
  handleTakePhoto: () => Promise<void>;
  handleResetCapture: () => Promise<void>;
  handlePickImage: () => Promise<void>;
  
  // Quote saving
  saveScannedQuote: (text: string, book?: string | null, author?: string | null) => Promise<{ success: boolean; quote?: Quote; error?: string }>;
  
  // ISBN actions
  checkAndHandleIsbn: (text: string) => Promise<boolean>;
  handleIsbnPopupPress: () => void;
  handleIsbnPopupDismiss: () => void;
  
  // Random quote actions
  handleRandomQuotePress: () => void;
  
  // OCR Live actions
  handleTextDetectedChange: (detected: boolean) => void;
  
  // Code scanner
  codeScanner: any;
  regionOfInterest: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | undefined;
  
  // Cleanup
  cleanup: () => void;
}

/**
 * Résultat complet du hook useScanController
 */
export interface ScanControllerResult extends ScanControllerState, ScanControllerActions {}

/**
 * Hook principal pour gérer toute la logique de ScanScreen
 * Combine ScanService, camera management, et state local
 */
export const useScanController = (
  props: UseScanControllerProps
): ScanControllerResult => {
  const { isFocused, containerSize, scanFrameLayout, scanAreaY, tabController, quotes: quotesProp, currentUser: currentUserProp } = props;
  const { user: currentUserFromAuth } = useAuth();
  const router = useRouter();

  // Utiliser les dépendances injectées ou les valeurs par défaut
  const currentUser = currentUserProp ?? currentUserFromAuth;
  const quotes = quotesProp ?? [];
  const setTabIndex = tabController?.setTabIndex ?? (() => {});
  const setSwipeEnabled = tabController?.setSwipeEnabled ?? (() => {});

  // ========== CAMERA STATE ==========
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
    { fps: 30 }
  ]);
  const cameraRef = useRef<Camera | null>(null);

  // ========== SCAN STATE ==========
  const [photo, setPhoto] = useState<PhotoFile | null>(null);
  const [ocrElements, setOcrElements] = useState<TextElement[] | null>(null);
  const [ocrBlocks, setOcrBlocks] = useState<TextBlock[] | null>(null);
  const [ocrNormalizedSize, setOcrNormalizedSize] = useState<{ width: number; height: number } | null>(null);
  const [isFromGallery, setIsFromGallery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPickerActive, setIsPickerActive] = useState(false);

  // ========== ISBN STATE ==========
  const [showIsbnPopup, setShowIsbnPopup] = useState(false);
  const [isbnBookData, setIsbnBookData] = useState<IsbnBookData | null>(null);
  const [isSearchingIsbn, setIsSearchingIsbn] = useState(false);
  
  const isSearchingIsbnRef = useRef(false);

  // ========== RANDOM QUOTE STATE ==========
  const [randomQuote, setRandomQuote] = useState<any | null>(null);
  const [showRandomQuoteModal, setShowRandomQuoteModal] = useState(false);

  // ========== OCR LIVE STATE ==========
  const [isTextDetectedLive, setIsTextDetectedLive] = useState(false);

  // ========== LOCK REFS ==========
  const scanLockRef = useRef(false);

  // ========== QUOTE SAVING ==========
  /**
   * Sauvegarde une citation scannée via QuoteUseCases
   */
  const saveScannedQuote = useCallback(async (
    text: string,
    book?: string | null,
    author?: string | null
  ): Promise<{ success: boolean; quote?: Quote; error?: string }> => {
    try {
      console.log('[ScanController] Saving quote via QuoteUseCases');
      const newQuote = await quoteService.createQuoteWithMatching(text, book, author);
      console.log('[ScanController] Quote saved successfully:', newQuote);
      return { success: true, quote: newQuote, error: undefined };
    } catch (error) {
      console.error('[ScanController] Failed to save quote:', error);
      return {
        success: false,
        quote: undefined,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }, []);

  // ========== ISBN HANDLERS ==========
  const checkAndHandleIsbn = useCallback(async (text: string): Promise<boolean> => {
    if (isSearchingIsbnRef.current || isSearchingIsbn) {
      console.log('[ScanController] Already processing or popup visible, ignoring duplicate trigger.');
      return false;
    }

    setIsSearchingIsbn(true);
    isSearchingIsbnRef.current = true;
    scanLockRef.current = true;
    console.log('[ScanController] Starting ISBN search.');

    let popupShown = false;
    try {
      const result = await scanService.checkAndHandleIsbn(text);
      
      if (result.success && result.bookData) {
        console.log('[ScanController] Book found, showing popup.');
        setIsbnBookData(result.bookData);
        setShowIsbnPopup(true);
        popupShown = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error searching ISBN:', error);
      return false;
    } finally {
      isSearchingIsbnRef.current = false;
      if (!popupShown) {
        setIsSearchingIsbn(false);
        scanLockRef.current = false;
      }
    }
  }, [isSearchingIsbn]);

  const handleIsbnPopupPress = useCallback(() => {
    if (!isbnBookData) return;
    console.log('[ScanController] ISBN popup pressed. Navigating.');
    setShowIsbnPopup(false);
    scanLockRef.current = false;
    setIsSearchingIsbn(false);

    const coverParam = isbnBookData.cover || undefined;

    if (isbnBookData.bookData) {
      router.push({
        pathname: '/book-detail',
        params: {
          bookTitle: isbnBookData.title,
          inventaireUri: isbnBookData.inventaireUri,
          bookData: JSON.stringify(isbnBookData.bookData),
          ...(coverParam ? { cover: coverParam } : {}),
        },
      });
    } else if (isbnBookData.bookId) {
      router.push({
        pathname: '/book-detail',
        params: {
          bookId: isbnBookData.bookId,
          inventaireUri: isbnBookData.inventaireUri,
          ...(coverParam ? { cover: coverParam } : {}),
        },
      });
    } else if (isbnBookData.inventaireUri) {
      router.push({
        pathname: '/book-detail',
        params: {
          bookTitle: isbnBookData.title,
          inventaireUri: isbnBookData.inventaireUri,
        },
      });
    }
    setIsbnBookData(null);
  }, [isbnBookData, router]);

  const handleIsbnPopupDismiss = useCallback(() => {
    console.log('[ScanController] ISBN popup dismissed.');
    setShowIsbnPopup(false);
    setIsbnBookData(null);
    isSearchingIsbnRef.current = false;
    scanLockRef.current = false;
    setIsSearchingIsbn(false);
  }, []);

  // ========== RANDOM QUOTE HANDLERS ==========
  const handleRandomQuotePress = useCallback(async () => {
    try {
      const result = await scanService.getRandomQuoteFromOtherUsers(quotes, currentUser?.id);
      
      if (result.success && result.quote) {
        PlatformServices.haptics.impactAsync("light");
        setRandomQuote(result.quote);
        setShowRandomQuoteModal(true);
      } else {
        Alert.alert("Aucune citation", "Aucune citation d'autres utilisateurs n'est disponible pour le moment.");
      }
    } catch (error) {
      Alert.alert("Aucune citation", "Aucune citation d'autres utilisateurs n'est disponible pour le moment.");
    }
  }, [quotes, currentUser?.id]);

  const handleTextDetectedChange = useCallback((detected: boolean) => {
    setIsTextDetectedLive(detected);
  }, []);

  // ========== CODE SCANNER ==========
  const regionOfInterest = useMemo(() => {
    if (!scanFrameLayout || containerSize.width === 0 || containerSize.height === 0) {
      return undefined;
    }
    return {
      x: scanFrameLayout.x / containerSize.width,
      y: (scanAreaY + scanFrameLayout.y) / containerSize.height,
      width: scanFrameLayout.width / containerSize.width,
      height: scanFrameLayout.height / containerSize.height,
    };
  }, [scanFrameLayout, scanAreaY, containerSize]);

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8'],
    onCodeScanned: (codes, scannerFrame) => {
      if (!isFocused || photo || isLoading || showIsbnPopup || isSearchingIsbn) {
        return;
      }
      if (codes.length > 0 && codes[0].value) {
        const code = codes[0];

        // Filter codes to only those inside the visual scan frame area
        if (code.frame && scanFrameLayout && containerSize.width > 0 && scannerFrame.width > 0 && scannerFrame.height > 0) {
          const isFrameLandscape = scannerFrame.width > scannerFrame.height;

          let x_screen = 0;
          let y_screen = 0;

          if (isFrameLandscape) {
            const scaleX = containerSize.width / scannerFrame.height;
            const scaleY = containerSize.height / scannerFrame.width;
            const scale = Math.max(scaleX, scaleY);

            const scaledWidth = scannerFrame.height * scale;
            const scaledHeight = scannerFrame.width * scale;

            const offsetX = (scaledWidth - containerSize.width) / 2;
            const offsetY = (scaledHeight - containerSize.height) / 2;

            const codeCenterX = code.frame.x + code.frame.width / 2;
            const codeCenterY = code.frame.y + code.frame.height / 2;

            x_screen = codeCenterY * scale - offsetX;
            y_screen = codeCenterX * scale - offsetY;
          } else {
            const scaleX = containerSize.width / scannerFrame.width;
            const scaleY = containerSize.height / scannerFrame.height;
            const scale = Math.max(scaleX, scaleY);

            const scaledWidth = scannerFrame.width * scale;
            const scaledHeight = scannerFrame.height * scale;

            const offsetX = (scaledWidth - containerSize.width) / 2;
            const offsetY = (scaledHeight - containerSize.height) / 2;

            const codeCenterX = code.frame.x + code.frame.width / 2;
            const codeCenterY = code.frame.y + code.frame.height / 2;

            x_screen = codeCenterX * scale - offsetX;
            y_screen = codeCenterY * scale - offsetY;
          }

          const frameLeft = scanFrameLayout.x;
          const frameRight = scanFrameLayout.x + scanFrameLayout.width;
          const frameTop = scanAreaY + scanFrameLayout.y;
          const frameBottom = scanAreaY + scanFrameLayout.y + scanFrameLayout.height;

          const isInside = x_screen >= frameLeft && x_screen <= frameRight &&
            y_screen >= frameTop && y_screen <= frameBottom;

          if (!isInside) {
            console.log('[ScanController] Ignored barcode outside visual frame:', code.value);
            return;
          }
        }

        console.log('[ScanController] Barcode scanned:', code.value);
        checkAndHandleIsbn(code.value!);
      }
    },
    regionOfInterest: regionOfInterest,
  });

  // ========== PHOTO CAPTURE HANDLERS ==========
  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current || isLoading || !isFocused) {
      console.log('[ScanController] handleTakePhoto: camera not ready or loading.');
      return;
    }

    setIsLoading(true);
    scanLockRef.current = true;
    console.log('[ScanController] handleTakePhoto: lock acquired.');

    try {
      if (!cameraRef.current || !isFocused) {
        console.log('[ScanController] handleTakePhoto: Camera unmounted or screen lost focus.');
        setIsLoading(false);
        scanLockRef.current = false;
        return;
      }

      console.log('[ScanController] Taking photo...');
      const photoFile = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      console.log('[ScanController] Photo taken. Processing...');
      
      // Utiliser ScanService pour traiter la photo
      const result = await scanService.capturePhotoAndRecognize(photoFile);
      
      if (!result.success || !result.ocrResult || !result.photo) {
        console.log('[ScanController] No text recognized or error:', result.error);
        setPhoto(null);
        setOcrElements(null);
        setOcrBlocks(null);
        Alert.alert(
          "Aucun texte détecté",
          "Nous n'avons détecté aucun texte dans l'image. Assurez-vous d'avoir bien cadré le texte et qu'il y a assez de lumière."
        );
        return;
      }

      console.log('[ScanController] Text recognized successfully.');
      
      setIsFromGallery(false);
      setPhoto(result.photo);
      setOcrElements(result.ocrResult.elements);
      setOcrBlocks(result.ocrResult.blocks || null);
      setOcrNormalizedSize(result.ocrResult.normalizedSize || null);
      
    } catch (error) {
      console.error('Failed to take photo or recognize text:', error);
      setPhoto(null);
      setOcrElements(null);
      Alert.alert(
        "Erreur de scan",
        `Une erreur est survenue lors de la prise de photo ou de la détection de texte : ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scanLockRef.current = false;
        console.log('[ScanController] handleTakePhoto finished. Lock released.');
      }, 100);
    }
  }, [isLoading, isFocused, cameraRef]);

  const handleResetCapture = useCallback(async () => {
    if (photo?.path) {
      await scanService.cleanupPhoto(photo);
    }
    setPhoto(null);
    setOcrElements(null);
    setOcrBlocks(null);
    setOcrNormalizedSize(null);
    setIsFromGallery(false);
    setIsTextDetectedLive(false);
  }, [photo]);

  const handlePickImage = useCallback(async () => {
    try {
      if (isLoading || isPickerActive) {
        console.log('[ScanController] handlePickImage: ignored, loading or picker active');
        return;
      }
      console.log('[ScanController] handlePickImage: starting gallery selection');

      // Check permission
      let permission = await ExpoImagePicker.getMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        permission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
          console.log('[ScanController] handlePickImage: permission denied');
          return;
        }
        // Wait for dialog animation
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      setIsPickerActive(true);

      setTimeout(async () => {
        try {
          const result = await ExpoImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 1,
          });

          if (result.canceled || !result.assets || result.assets.length === 0) {
            console.log('[ScanController] handlePickImage: gallery selection canceled');
            setIsPickerActive(false);
            return;
          }

          setIsLoading(true);
          const asset = result.assets[0];
          const cleanPath = asset.uri.startsWith('file://') ? asset.uri : `file://${asset.uri}`;
          console.log('[ScanController] handlePickImage: asset selected:', cleanPath);

          // Utiliser ScanService pour traiter l'image de la galerie
          const serviceResult = await scanService.pickImageFromGalleryAndRecognize(cleanPath);
          
          if (serviceResult.isIsbn && serviceResult.bookData) {
            // ISBN détecté, afficher le popup
            console.log('[ScanController] ISBN detected from gallery.');
            setIsbnBookData(serviceResult.bookData);
            setShowIsbnPopup(true);
            setIsPickerActive(false);
            return;
          }

          if (!serviceResult.success || !serviceResult.photo || !serviceResult.ocrResult) {
            console.log('[ScanController] No text recognized in gallery image');
            setIsPickerActive(false);
            return;
          }

          // Image normale avec texte
          const pickedPhoto: PhotoFile = {
            path: cleanPath,
            width: asset.width,
            height: asset.height,
            isRawPhoto: false,
            metadata: { Orientation: 1 } as any,
          } as PhotoFile;

          setIsFromGallery(true);
          setPhoto(pickedPhoto);
          setOcrElements(serviceResult.ocrResult.elements);
          setOcrBlocks(serviceResult.ocrResult.blocks || []);
          setOcrNormalizedSize(serviceResult.ocrResult.normalizedSize || null);
          
        } catch (innerError) {
          console.error('Picker launch error:', innerError);
        } finally {
          setIsLoading(false);
          setIsPickerActive(false);
        }
      }, 300);

    } catch (error: any) {
      console.error('Picker error:', error);
      setIsLoading(false);
      setIsPickerActive(false);
    }
  }, [isLoading, isPickerActive]);

  // ========== EFFETS ==========
  // Cleanup au unmount
  const cleanup = useCallback(() => {
    console.log('[ScanController] Cleanup: releasing locks and clearing temp files.');
    scanLockRef.current = false;
    FileSystem.deleteAsync(`${FileSystem.cacheDirectory}VisionCamera`, { idempotent: true }).catch(console.error);
  }, []);

  // ========== RENDER RESULT ==========
  return {
    // Camera state
    hasPermission,
    device,
    format,
    cameraRef,
    
    // Scan state
    photo,
    ocrElements,
    ocrBlocks,
    ocrNormalizedSize,
    isFromGallery,
    isLoading,
    isPickerActive,
    
    // ISBN state
    showIsbnPopup,
    isbnBookData,
    isSearchingIsbn,
    
    // Random quote state
    randomQuote,
    showRandomQuoteModal,
    setShowRandomQuoteModal,
    
    // OCR Live state
    isTextDetectedLive,
    
    // Lock refs
    scanLockRef,
    isSearchingIsbnRef,
    
    // Camera actions
    requestPermission,
    
    // Scan actions
    handleTakePhoto,
    handleResetCapture,
    handlePickImage,
    
    // Quote saving
    saveScannedQuote,
    
    // ISBN actions
    checkAndHandleIsbn,
    handleIsbnPopupPress,
    handleIsbnPopupDismiss,
    
    // Random quote actions
    handleRandomQuotePress,
    
    // OCR Live actions
    handleTextDetectedChange,
    
    // Code scanner
    codeScanner,
    regionOfInterest,
    
    // Cleanup
    cleanup,
  };
};
