import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets, EdgeInsets } from 'react-native-safe-area-context';
import { useRouter } from '@/src/shared/navigation/useRouter';
import Svg, { Mask, Rect } from 'react-native-svg';
import { TOUR_STEPS, TourStep, useAppTourState } from '@/src/shared/stores/appTourStore';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';

interface TargetGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

const STEP_MESSAGES: Record<TourStep, string> = {
  scanButton: "Le bouton scan permet de scanner un passage d'un livre pour enregistrer une citation.",
  scanGalleryButton: "L'icône image permet de scanner une citation depuis sa pellicule.",
  myQuotesList: "Les citations enregistrées se retrouvent ici.",
  quoteCardDetail: "Appuyez sur une citation pour afficher ses détails.",
  quoteDetailIA: "L'IA met en contexte la citation et propose des œuvres en rapport avec son thème.",
  quoteDetailClose: "Appuyez sur cette croix pour fermer la fiche et revenir à votre liste de citations.",
  filterTabs: "Vos citations sont regroupées par catégorie : Citations, Livres, Auteurs et Thèmes. Appuyez sur un onglet pour changer de vue.",
  searchButton: "Vous pouvez rechercher les œuvres/auteurs de votre choix et les ajouter à votre bibliothèque.",
  addQuoteButton: "Le bouton + permet de rajouter une citation manuellement.",
};

const STEP_TARGET_BUILDERS: Record<
  TourStep,
  (screenWidth: number, screenHeight: number, insets: EdgeInsets) => TargetGeometry
> = {
  scanButton: (w, h, insets) => ({
    x: Math.round(w / 2 - 32),
    y: Math.round(h - Math.max(insets.bottom, 16) - 94),
    width: 64,
    height: 64,
    borderRadius: 32,
  }),
  scanGalleryButton: (w, h, insets) => ({
    x: Math.round(w / 2 - 96),
    y: Math.round(h - Math.max(insets.bottom, 16) - 84),
    width: 45,
    height: 45,
    borderRadius: 12,
  }),
  myQuotesList: (w, _, insets) => ({
    x: 16,
    y: Math.round(insets.top + 195),
    width: w - 32,
    height: 160,
    borderRadius: 16,
  }),
  quoteCardDetail: (w, _, insets) => ({
    x: 16,
    y: Math.round(insets.top + 195),
    width: w - 32,
    height: 160,
    borderRadius: 16,
  }),
  quoteDetailIA: (w, _, insets) => ({
    x: 16,
    y: Math.round(insets.top + 250),
    width: w - 32,
    height: 150,
    borderRadius: 16,
  }),
  quoteDetailClose: (w, _, insets) => ({
    x: Math.round(w - 48),
    y: Math.round(insets.top + 12),
    width: 36,
    height: 36,
    borderRadius: 18,
  }),
  filterTabs: (w, _, insets) => ({
    x: 0,
    y: Math.round(insets.top + 68),
    width: w,
    height: 64,
    borderRadius: 14,
  }),
  searchButton: (w, _, insets) => ({
    x: Math.round(w - 96),
    y: Math.round(insets.top + 16),
    width: 36,
    height: 36,
    borderRadius: 8,
  }),
  addQuoteButton: (w, _, insets) => ({
    x: Math.round(w - 140),
    y: Math.round(insets.top + 16),
    width: 36,
    height: 36,
    borderRadius: 8,
  }),
};

interface AppTourOverlayProps {
  isInsideModalContainer?: boolean;
}

export function AppTourOverlay({ isInsideModalContainer = false }: AppTourOverlayProps) {
  const { isActive, currentStepIndex, targetRect, nextStep, prevStep, stopTour } = useAppTourState();
  const colors = useTheme().colors;
  const router = useRouter();
  const quoteContext = useQuote();
  const quotes = quoteContext?.quotes || [];
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  if (!isActive) return null;

  const activeStepName = TOUR_STEPS[currentStepIndex];
  const isInsideModalStep = activeStepName === 'quoteDetailIA' || activeStepName === 'quoteDetailClose';

  // Si on est dans le Root Overlay mais que l'etape active est une etape de modale, on ne rend rien
  if (!isInsideModalContainer && isInsideModalStep) return null;
  // Inverser : si on est dans le Modal Overlay mais qu'on n'est pas sur une etape modale, on ne rend rien
  if (isInsideModalContainer && !isInsideModalStep) return null;

  const currentStepMessage = STEP_MESSAGES[activeStepName] || '';

  const isValidMeasuredRect =
    targetRect &&
    typeof targetRect.x === 'number' && Number.isFinite(targetRect.x) &&
    typeof targetRect.y === 'number' && Number.isFinite(targetRect.y) &&
    typeof targetRect.width === 'number' && Number.isFinite(targetRect.width) && targetRect.width > 0 &&
    typeof targetRect.height === 'number' && Number.isFinite(targetRect.height) && targetRect.height > 0;

  const builder = STEP_TARGET_BUILDERS[activeStepName];
  const fallbackTarget = builder
    ? builder(width, height, insets)
    : { x: Math.round(width / 2 - 20), y: Math.round(height / 2 - 20), width: 36, height: 36, borderRadius: 8 };

  let target: TargetGeometry = isValidMeasuredRect && targetRect
    ? {
        x: targetRect.x,
        y: targetRect.y,
        width: targetRect.width,
        height: targetRect.height,
        borderRadius: fallbackTarget.borderRadius ?? 8,
      }
    : fallbackTarget;

  // Ajustements specifiques de decoupe selon les etapes
  if (activeStepName === 'scanGalleryButton') {
    // Bouton Galerie : carre 45x45 a coins arrondis (borderRadius: 12)
    target = {
      ...target,
      width: 45,
      height: 45,
      borderRadius: 12,
    };
  } else if (activeStepName === 'myQuotesList' || activeStepName === 'quoteCardDetail') {
    target = {
      ...target,
      height: Math.max(40, target.height - 16),
      borderRadius: 16,
    };
  } else if (activeStepName === 'filterTabs') {
    target = {
      x: 0,
      y: target.y + 16,
      width: width,
      height: Math.max(50, target.height - 20),
      borderRadius: 14,
    };
  } else if (activeStepName === 'searchButton' || activeStepName === 'addQuoteButton') {
    target = {
      ...target,
      width: 36,
      height: 36,
      borderRadius: 8,
    };
  }

  const handleNext = async () => {
    try {
      if (activeStepName === 'quoteCardDetail') {
        const firstQuote = Array.isArray(quotes) && quotes.length > 0 ? quotes[0] : null;
        if (firstQuote && firstQuote.id != null) {
          nextStep();
          router.navigate({
            pathname: '/quote-detail',
            params: { quoteId: firstQuote.id.toString(), fromTour: 'true' }
          });
          return;
        }
      } else if (activeStepName === 'quoteDetailClose') {
        nextStep();
        router.back();
        return;
      }

      nextStep();
    } catch (err) {
      console.warn('[AppTourOverlay] handleNext error:', err);
      nextStep();
    }
  };

  const handlePrev = async () => {
    try {
      if (activeStepName === 'quoteDetailIA') {
        prevStep();
        router.back();
        return;
      } else if (activeStepName === 'filterTabs') {
        const firstQuote = Array.isArray(quotes) && quotes.length > 0 ? quotes[0] : null;
        if (firstQuote && firstQuote.id != null) {
          prevStep();
          router.navigate({
            pathname: '/quote-detail',
            params: { quoteId: firstQuote.id.toString(), fromTour: 'true' }
          });
          return;
        }
      }

      prevStep();
    } catch (err) {
      console.warn('[AppTourOverlay] handlePrev error:', err);
      prevStep();
    }
  };

  // Rayon d'arrondi
  const radius = target.borderRadius ?? 8;

  // Protection contre le depassement hors ecran lors du scroll
  const isOffScreen = target.y + target.height < 0 || target.y > height;
  const clampedTargetY = Math.max(-200, Math.min(height + 200, target.y));

  // Positionnement dynamique et securise de la carte explicative
  const isTargetInBottomHalf = clampedTargetY > height / 2;
  const cardPositionStyle: ViewStyle = isTargetInBottomHalf
    ? {
        bottom: Math.max(
          Math.max(insets.bottom, 20),
          Math.min(height - 180, height - clampedTargetY + 14)
        ),
        alignSelf: 'center',
      }
    : {
        top: Math.max(
          Math.max(insets.top, 20),
          Math.min(height - 180, clampedTargetY + target.height + 14)
        ),
        alignSelf: 'center',
      };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 1. Rendu Visuel SVG avec coins arrondis et cercles parfaits */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Mask id="tour-mask-cutout">
          <Rect x="0" y="0" width={width} height={height} fill="white" />
          {!isOffScreen && (
            <Rect
              x={target.x}
              y={target.y}
              width={target.width}
              height={target.height}
              rx={radius}
              ry={radius}
              fill="black"
            />
          )}
        </Mask>

        <Rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#tour-mask-cutout)"
        />
      </Svg>

      {/* 2. Couche de blocage tactile : 4 panneaux transparents qui absorbent tous les clics HORS du trou */}
      <View
        pointerEvents="auto"
        style={[
          styles.backdropPanel,
          { top: 0, left: 0, right: 0, height: Math.max(0, target.y) },
        ]}
      />
      <View
        pointerEvents="auto"
        style={[
          styles.backdropPanel,
          {
            top: target.y + target.height,
            left: 0,
            right: 0,
            bottom: 0,
          },
        ]}
      />
      <View
        pointerEvents="auto"
        style={[
          styles.backdropPanel,
          {
            top: Math.max(0, target.y),
            height: target.height,
            left: 0,
            width: Math.max(0, target.x),
          },
        ]}
      />
      <View
        pointerEvents="auto"
        style={[
          styles.backdropPanel,
          {
            top: Math.max(0, target.y),
            height: target.height,
            left: target.x + target.width,
            right: 0,
          },
        ]}
      />

      {/* 3. Carte explicative du tour */}
      <View
        pointerEvents="auto"
        style={[
          styles.cardContainer,
          {
            backgroundColor: colors.surface,
            borderColor: colors.surfaceHighlight,
            width: Math.min(width - 36, 320),
          },
          cardPositionStyle,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.stepBadge, { color: colors.primary, backgroundColor: colors.primaryLight }]}>
            Étape {currentStepIndex + 1} / {TOUR_STEPS.length}
          </Text>
          <TouchableOpacity onPress={stopTour} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Passer</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.message, { color: colors.text }]}>{currentStepMessage}</Text>

        <View style={styles.footer}>
          {currentStepIndex > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.backButton, { borderColor: colors.border }]}
              onPress={handlePrev}
            >
              <Text style={[styles.backButtonText, { color: colors.text }]}>Retour</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.button, styles.nextButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
          >
            <Text style={[styles.nextButtonText, { color: colors.buttonText }]}>
              {currentStepIndex === TOUR_STEPS.length - 1 ? 'Terminer' : 'Suivant'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdropPanel: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 99990,
  },
  cardContainer: {
    position: 'absolute',
    zIndex: 99999,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  skipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  nextButton: {
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  nextButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
