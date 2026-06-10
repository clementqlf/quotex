import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCopilot } from 'react-native-copilot';
import { useTabIndex } from '@/src/app/providers/TabContext';

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
  const { start, copilotEvents } = useCopilot();
  const { setPage } = useTabIndex();
  const tourStarted = useRef(false);

  useEffect(() => {
    const checkTutorial = async () => {
      if (tourStarted.current) return;
      
      const hasSeenTour = await AsyncStorage.getItem('has_seen_tour');
      if (!hasSeenTour) {
        tourStarted.current = true;
        setTimeout(() => {
          start().catch((err) => console.log('Copilot error:', err));
        }, 1500);
      }
    };
    
    checkTutorial();

    const handleStepChange = (step: any) => {
      console.log('[Copilot] Step changed:', step.name);
      
      if (step.name === 'myQuotesList') {
        setPage?.(0);
      } else if (step.name === 'scanButton') {
        setPage?.(1);
      }
    };

    const handleStop = async () => {
      await AsyncStorage.setItem('has_seen_tour', 'true');
    };

    copilotEvents.on('stepChange', handleStepChange);
    copilotEvents.on('stop', handleStop);

    return () => {
      copilotEvents.off('stepChange', handleStepChange);
      copilotEvents.off('stop', handleStop);
    };
  }, [start, copilotEvents, setPage]);

  const resetTour = async () => {
    tourStarted.current = false;
    await AsyncStorage.removeItem('has_seen_tour');
  };

  return { resetTour };
}
