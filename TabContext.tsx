import { createContext, useContext } from 'react';

// 1. Créer un contexte pour l'index de l'onglet et sa fonction de mise à jour.
export const TabIndexContext = createContext({
  tabIndex: 1, // Index de départ
  setTabIndex: (index: number) => {}, // Fonction vide par défaut
});

// 2. Créer un hook personnalisé pour utiliser facilement ce contexte.
export const useTabIndex = () => useContext(TabIndexContext);