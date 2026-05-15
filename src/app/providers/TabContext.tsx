import React, { createContext, useContext } from 'react';

type TabIndexContextType = {
  tabIndex: number;
  setTabIndex: (index: number) => void;
};

export const TabIndexContext = createContext<TabIndexContextType>({
  tabIndex: 1,
  setTabIndex: () => {},
});

export const useTabIndex = () => useContext(TabIndexContext);

type SwipeEnabledContextType = {
  swipeEnabled: boolean;
  setSwipeEnabled: (enabled: boolean) => void;
};

export const SwipeEnabledContext = createContext<SwipeEnabledContextType>({
  swipeEnabled: true,
  setSwipeEnabled: () => {},
});

export const useSwipeEnabled = () => useContext(SwipeEnabledContext);
