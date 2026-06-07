import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';

/**
 * Type pour le contexte de l'index des tabs
 */
interface TabIndexContextType {
  tabIndex: number;
  setTabIndex: (index: number) => void;
}

/**
 * Type pour le contexte de l'état du swipe
 */
interface SwipeEnabledContextType {
  swipeEnabled: boolean;
  setSwipeEnabled: (enabled: boolean) => void;
}

// Contexte pour l'index des tabs (déjà existant)
export const TabIndexContext = createContext<TabIndexContextType>({
  tabIndex: 1,
  setTabIndex: () => {},
});

// Contexte pour l'état du swipe (déjà existant)
export const SwipeEnabledContext = createContext<SwipeEnabledContextType>({
  swipeEnabled: true,
  setSwipeEnabled: () => {},
});

// Hooks pour accéder aux contextes
export const useTabIndex = () => useContext(TabIndexContext);
export const useSwipeEnabled = () => useContext(SwipeEnabledContext);

/**
 * Résultat du hook useTabController
 */
export interface TabControllerResult {
  // State
  tabIndex: number;
  swipeEnabled: boolean;
  position: any; // useSharedValue<number>
  
  // Réfs
  pagerRef: React.RefObject<PagerView | null>;
  
  // Handlers
  setPage: (idx: number) => void;
  setTabIndex: (index: number) => void;
  setSwipeEnabled: (enabled: boolean) => void;
  onPageScroll: (event: any) => void;
  onPageSelected: (e: any) => void;
}

/**
 * Hook pour gérer la logique des tabs de manière centralisée
 * Ce hook encapsule toute la logique de state management pour les tabs
 */
export const useTabController = (): TabControllerResult => {
  const [index, setIndex] = useState(1);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const position = useSharedValue(1);
  const pagerRef = useRef<PagerView | null>(null);

  // Handler pour le scroll des pages
  const onPageScroll = useCallback((event: any) => {
    'worklet';
    position.value = event.position + event.offset;
  }, []);

  // Handler pour la sélection des pages
  const onPageSelected = useCallback((e: any) => {
    setIndex(e.nativeEvent.position);
  }, []);

  // Fonction pour changer de page
  const setPage = useCallback((idx: number) => {
    if (idx !== index) {
      setIndex(idx);
      position.value = idx;
      pagerRef.current?.setPage(idx);
    }
  }, [index]);

  return {
    tabIndex: index,
    swipeEnabled,
    position,
    pagerRef,
    setPage,
    setTabIndex: setIndex,
    setSwipeEnabled,
    onPageScroll,
    onPageSelected,
  };
};

/**
 * Provider pour la gestion des tabs
 * Centralise toute la logique de state management pour les tabs
 */
export const TabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const controller = useTabController();

  return (
    <TabIndexContext.Provider value={{
      tabIndex: controller.tabIndex,
      setTabIndex: controller.setTabIndex,
    }}>
      <SwipeEnabledContext.Provider value={{
        swipeEnabled: controller.swipeEnabled,
        setSwipeEnabled: controller.setSwipeEnabled,
      }}>
        {children}
      </SwipeEnabledContext.Provider>
    </TabIndexContext.Provider>
  );
};
