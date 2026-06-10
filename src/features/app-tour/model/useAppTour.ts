import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTabIndex } from '@/src/app/providers/TabContext';
import { useAppTourState, TourStep, TOUR_STEPS } from './useAppTourState';

/**
 * Hook useAppTour
 * Gère tout le cycle de vie de la visite guidée (App Tour) :
 * - Vérification de première connexion via AsyncStorage
 * - Démarrage automatique du tutoriel
 * - Changements d'onglets synchronisés avec les étapes
 * - Persistance de fin de tutoriel
 * - Fonction de réinitialisation de debug
 */
export function useAppTour() {
  const { isActive, currentStepIndex, startTour, resetTour } = useAppTourState();
  const { setPage } = useTabIndex();
  const tourStarted = useRef(false);

  useEffect(() => {
    const checkTutorial = async () => {
      if (tourStarted.current) return;
      
      const hasSeenTour = await AsyncStorage.getItem('has_seen_tour');
      if (!hasSeenTour) {
        tourStarted.current = true;
        setTimeout(() => {
          startTour();
        }, 1500);
      }
    };
    
    checkTutorial();
  }, [startTour]);

  useEffect(() => {
    if (isActive) {
      const stepName = TOUR_STEPS[currentStepIndex];
      if (
        stepName === 'myQuotesList' ||
        stepName === 'filterTabs' ||
        stepName === 'searchButton' ||
        stepName === 'addQuoteButton'
      ) {
        setPage?.(0);
      } else if (stepName === 'scanButton' || stepName === 'scanGalleryButton') {
        setPage?.(1);
      }
    }
  }, [isActive, currentStepIndex, setPage]);

  return { resetTour };
}
