import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const TOUR_STEPS = [
  'scanButton',         // 1
  'scanGalleryButton',  // 2
  'myQuotesList',       // 3
  'quoteCardDetail',    // 4
  'quoteDetailIA',      // 5
  'quoteDetailClose',   // 6
  'filterTabs',         // 7
  'searchButton',       // 8
  'addQuoteButton'      // 9
] as const;

export type TourStep = typeof TOUR_STEPS[number];

interface AppTourState {
  isActive: boolean;
  currentStepIndex: number;
  userId: string | null;
  setUserId: (userId: string | null) => void;
  startTour: (stepName?: TourStep) => void;
  stopTour: () => Promise<void>;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (stepName: TourStep) => void;
  resetTour: () => Promise<void>;
}

export const useAppTourState = create<AppTourState>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,
  userId: null,

  setUserId: (userId: string | null) => set({ userId }),

  startTour: (stepName?: TourStep) => {
    let startIndex = 0;
    if (stepName) {
      startIndex = TOUR_STEPS.indexOf(stepName);
      if (startIndex === -1) startIndex = 0;
    }
    set({ isActive: true, currentStepIndex: startIndex });
  },

  stopTour: async () => {
    const { userId } = get();
    set({ isActive: false });
    const key = userId ? `has_seen_tour_${userId}` : 'has_seen_tour';
    await AsyncStorage.setItem(key, 'true');
    await AsyncStorage.removeItem('resume_tour_step');
  },

  nextStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1 });
    } else {
      get().stopTour();
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  setStep: (stepName: TourStep) => {
    const index = TOUR_STEPS.indexOf(stepName);
    if (index !== -1) {
      set({ currentStepIndex: index });
    }
  },

  resetTour: async () => {
    const { userId } = get();
    set({ isActive: false, currentStepIndex: 0 });
    const key = userId ? `has_seen_tour_${userId}` : 'has_seen_tour';
    await AsyncStorage.removeItem(key);
    await AsyncStorage.removeItem('resume_tour_step');
  }
}));
