import { useTabIndex } from '@/src/app/providers/TabContext';
import { useAuth } from '@/src/app/providers/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { TOUR_STEPS, useAppTourState } from './useAppTourState';

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
  const { isActive, currentStepIndex, startTour, resetTour, setUserId } = useAppTourState();
  const { setPage } = useTabIndex();
  const { user } = useAuth();
  const tourStarted = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      setUserId(user.id);
    } else {
      setUserId(null);
    }
  }, [user?.id, setUserId]);

  useEffect(() => {
    if (!user?.id) {
      tourStarted.current = null;
      return;
    }

    const checkTutorial = async () => {
      if (tourStarted.current === user.id) return;
      
      const key = `has_seen_tour_${user.id}`;
      const hasSeenTour = await AsyncStorage.getItem(key);
      if (!hasSeenTour) {
        tourStarted.current = user.id;
        setTimeout(() => {
          startTour();
        }, 1500);
      }
    };
    
    checkTutorial();
  }, [startTour, user?.id]);

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
