import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { IQuoteRepository } from '@/src/entities/quote/api/IQuoteRepository';
import { SupabaseQuoteRepository } from '@/src/entities/quote/api/SupabaseQuoteRepository';
import { IAuthorRepository } from '@/src/entities/author/api/IAuthorRepository';
import { SupabaseAuthorRepository } from '@/src/entities/author/api/SupabaseAuthorRepository';

/**
 * Type pour le contexte des repositories
 */
type RepositoriesContextType = {
  quoteRepository: IQuoteRepository;
  authorRepository: IAuthorRepository;
};

const RepositoriesContext = createContext<RepositoriesContextType | undefined>(undefined);

/**
 * Provider pour l'injection de dépendances des repositories
 * Permet de centraliser la création des repositories et de les injecter
 */
export const RepositoriesProvider = ({ children }: { children: ReactNode }) => {
  // Créer les instances des repositories (Singleton)
  const repositories = useMemo(() => ({
    quoteRepository: SupabaseQuoteRepository.getInstance(),
    authorRepository: SupabaseAuthorRepository.getInstance(),
  }), []);

  return (
    <RepositoriesContext.Provider value={repositories}>
      {children}
    </RepositoriesContext.Provider>
  );
};

/**
 * Hook pour accéder aux repositories
 */
export const useRepositories = (): RepositoriesContextType => {
  const context = useContext(RepositoriesContext);
  if (context === undefined) {
    throw new Error('useRepositories must be used within a RepositoriesProvider');
  }
  return context;
};
