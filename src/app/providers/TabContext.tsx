import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import PagerView from 'react-native-pager-view';
import { SharedValue, useSharedValue } from 'react-native-reanimated';

// Types précis pour les événements
interface PageScrollEvent {
    position: number;
    offset: number;
}

interface PageSelectedEvent {
    nativeEvent: {
        position: number;
    };
}

/**
 * Type pour le contexte de l'index des tabs
 */
interface TabIndexContextType {
  tabIndex: number;
  setTabIndex: (index: number) => void;
  setPage?: (idx: number) => void;
  pagerRef?: React.RefObject<any>;
  onPageSelected?: (e: any) => void;
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
  position: SharedValue<number>;
  
  // Réfs
  pagerRef: React.RefObject<PagerView | null>;
  
  // Handlers
  setPage: (idx: number) => void;
  setTabIndex: (index: number) => void;
  setSwipeEnabled: (enabled: boolean) => void;
  onPageScroll: (event: PageScrollEvent) => void;
  onPageSelected: (e: PageSelectedEvent) => void;
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
  const onPageScroll = useCallback((event: PageScrollEvent) => {
    'worklet';
    // eslint-disable-next-line react-hooks/immutability
    position.value = event.position + event.offset;
  }, [position]);

  // Handler pour la sélection des pages
  const onPageSelected = useCallback((e: PageSelectedEvent) => {
    setIndex(e.nativeEvent.position);
  }, []);

  // Fonction pour changer de page
  const setPage = useCallback((idx: number) => {
    if (idx !== index) {
      setIndex(idx);
      // eslint-disable-next-line react-hooks/immutability
      position.value = idx;
      pagerRef.current?.setPage(idx);
    }
  }, [index, position, pagerRef]);

  // ✅ Memoize le résultat complet pour éviter les re-renders
  return useMemo(() => ({
    tabIndex: index,
    swipeEnabled,
    position,
    pagerRef,
    setPage,
    setTabIndex: setIndex,
    setSwipeEnabled,
    onPageScroll,
    onPageSelected,
  }), [index, swipeEnabled, position, pagerRef, setPage, setIndex, setSwipeEnabled, onPageScroll, onPageSelected]);
};

/**
 * Provider pour la gestion des tabs
 * Centralise toute la logique de state management pour les tabs
 */
export const TabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const controller = useTabController();

  // ✅ Memoize les valeurs des contextes pour éviter les re-renders
  const tabIndexValue = useMemo(() => ({
    tabIndex: controller.tabIndex,
    setTabIndex: controller.setTabIndex,
    setPage: controller.setPage,
    pagerRef: controller.pagerRef,
    onPageSelected: controller.onPageSelected,
  }), [controller.tabIndex, controller.setTabIndex, controller.setPage, controller.pagerRef, controller.onPageSelected]);

  const swipeEnabledValue = useMemo(() => ({
    swipeEnabled: controller.swipeEnabled,
    setSwipeEnabled: controller.setSwipeEnabled,
  }), [controller.swipeEnabled, controller.setSwipeEnabled]);

  return (
    <TabIndexContext.Provider value={tabIndexValue}>
      <SwipeEnabledContext.Provider value={swipeEnabledValue}>
        {children}
      </SwipeEnabledContext.Provider>
    </TabIndexContext.Provider>
  );
};
