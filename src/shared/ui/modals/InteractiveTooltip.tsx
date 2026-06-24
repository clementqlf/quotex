import { useTabIndex } from '@/src/app/providers/TabContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { useRouter } from 'expo-router';
import React, { ReactElement, useEffect, useState } from 'react';
import { Dimensions, Platform, StyleProp, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Tooltip from 'react-native-walkthrough-tooltip';
import { TOUR_STEPS, TourStep, useAppTourState } from '@/src/shared/stores/appTourStore';

interface Props {
  stepName?: TourStep;
  stepNames?: TourStep[];
  text?: string;
  texts?: string[];
  children: ReactElement<any>;
  allowChildInteraction?: boolean;
  closeOnChildInteraction?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  childrenWrapperStyle?: StyleProp<ViewStyle>;
  useReactNativeModal?: boolean;
  childContentSpacing?: number;
  verticalOffset?: number;
}

const STEP_TAB_MAP: Record<TourStep, number | null> = {
  scanButton: 1,
  scanGalleryButton: 1,
  myQuotesList: 0,
  quoteCardDetail: 0,
  quoteDetailIA: null,
  quoteDetailClose: null,
  filterTabs: 0,
  searchButton: 0,
  addQuoteButton: 0,
};

const STEP_DELAYS: Record<TourStep, number> = {
  scanButton: 50,
  scanGalleryButton: 50,
  myQuotesList: 600,     // Transition d'onglet (Scan -> MyQuotes)
  quoteCardDetail: 50,
  quoteDetailIA: 600,    // Ouverture de la modale détail
  quoteDetailClose: 600,   // Transition de retour modale (si retour)
  filterTabs: 600,       // Fermeture de la modale détail (retour liste)
  searchButton: 50,
  addQuoteButton: 50,
};

export function InteractiveTooltip({
  stepName,
  stepNames,
  text,
  texts,
  children,
  allowChildInteraction = false,
  closeOnChildInteraction = false,
  placement = 'bottom',
  childrenWrapperStyle,
  useReactNativeModal,
  childContentSpacing,
  verticalOffset,
}: Props) {
  const { isActive, currentStepIndex, nextStep, prevStep, stopTour } = useAppTourState();
  const colors = useTheme().colors;
  const router = useRouter();
  const { quotes } = useQuote();
  const { tabIndex } = useTabIndex();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  
  const [localVisible, setLocalVisible] = useState(false);

  const steps = stepNames ?? (stepName ? [stepName] : []);
  const messages = texts ?? (text ? [text] : []);

  const activeStepName = TOUR_STEPS[currentStepIndex];
  const stepIndexInProp = steps.indexOf(activeStepName);
  const isStepActive = isActive && stepIndexInProp !== -1;
  const currentStepMessage = messages[stepIndexInProp] || '';
  const globalStepIndex = TOUR_STEPS.indexOf(activeStepName);

  const isInsideModal = activeStepName === 'quoteDetailIA' || activeStepName === 'quoteDetailClose';
  const shouldReactNativeModal = useReactNativeModal ?? true;
  const tooltipBgColor = 'rgba(0,0,0,0.6)';

  const targetTab = activeStepName ? STEP_TAB_MAP[activeStepName] : null;
  const isTabCorrect = targetTab === null || targetTab === undefined || tabIndex === targetTab;
  const shouldBeVisible = isStepActive && isTabCorrect;

  if (!shouldBeVisible && localVisible) {
    setLocalVisible(false);
  }

  useEffect(() => {
    if (shouldBeVisible) {
      const delay = (activeStepName && STEP_DELAYS[activeStepName]) || 50;
      const timer = setTimeout(() => {
        setLocalVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [shouldBeVisible, activeStepName]);

  const handleNext = async () => {
    if (activeStepName === 'quoteCardDetail') {
      const firstQuote = quotes[0];
      if (firstQuote) {
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
  };

  const handlePrev = async () => {
    if (activeStepName === 'quoteDetailIA') {
      prevStep();
      router.back();
      return;
    } else if (activeStepName === 'filterTabs') {
      const firstQuote = quotes[0];
      if (firstQuote) {
        prevStep();
        router.navigate({
          pathname: '/quote-detail',
          params: { quoteId: firstQuote.id.toString(), fromTour: 'true' }
        });
        return;
      }
    }
    
    prevStep();
  };

  const baseTopAdjustment = isInsideModal && Platform.OS === 'ios' 
    ? Math.max(screenHeight - windowHeight, insets.top > 0 ? insets.top + 10 : 0) 
    : 0;

  const getPaddingStyle = () => {
    if (!verticalOffset) return {};
    switch (placement) {
      case 'bottom':
        return { paddingTop: verticalOffset };
      case 'top':
        return { paddingBottom: verticalOffset };
      case 'left':
        return { paddingRight: verticalOffset };
      case 'right':
        return { paddingLeft: verticalOffset };
      default:
        return {};
    }
  };

  return (
    <Tooltip
      key={activeStepName || 'inactive'}
      isVisible={localVisible}
      content={
        <View style={[
          styles.container, 
          { backgroundColor: colors.surface, borderColor: colors.surfaceHighlight }
        ]}>
          <View style={styles.header}>
            <Text style={[styles.stepBadge, { color: colors.primary, backgroundColor: colors.primaryLight }]}>
              Étape {globalStepIndex + 1} / {TOUR_STEPS.length}
            </Text>
            <TouchableOpacity onPress={stopTour}>
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>Passer</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.message, { color: colors.text }]}>{currentStepMessage}</Text>
          <View style={styles.footer}>
            {globalStepIndex > 0 && (
              <TouchableOpacity style={[styles.button, styles.backButton, { borderColor: colors.border }]} onPress={handlePrev}>
                <Text style={[styles.backButtonText, { color: colors.text }]}>Retour</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.button, styles.nextButton, { backgroundColor: colors.primary }]} onPress={handleNext}>
              <Text style={[styles.nextButtonText, { color: colors.buttonText }]}>
                {globalStepIndex === TOUR_STEPS.length - 1 ? 'Terminer' : 'Suivant'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      placement={placement}
      onClose={() => {}}
      allowChildInteraction={allowChildInteraction}
      closeOnChildInteraction={closeOnChildInteraction}
      backgroundColor={tooltipBgColor}
      backgroundStyle={{
        width: windowWidth,
        height: windowHeight,
      }}
      contentStyle={{ 
        backgroundColor: 'transparent', 
        padding: 0, 
        borderRadius: 18, 
        elevation: 0,
        ...getPaddingStyle()
      }}
      childrenWrapperStyle={childrenWrapperStyle}
      useReactNativeModal={shouldReactNativeModal}
      topAdjustment={baseTopAdjustment}
      childContentSpacing={childContentSpacing}
    >
      {children}
    </Tooltip>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 290,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
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
