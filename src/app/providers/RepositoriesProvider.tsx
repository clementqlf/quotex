import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { IQuoteRepository } from '@/src/entities/quote/api/IQuoteRepository';
import { SupabaseQuoteRepository } from '@/src/entities/quote/api/SupabaseQuoteRepository';
import { IAuthorRepository } from '@/src/entities/author/api/IAuthorRepository';
import { SupabaseAuthorRepository } from '@/src/entities/author/api/SupabaseAuthorRepository';

/**
 * Type pour le contexte des repositories
 */
export type RepositoriesContextType = {
  quoteRepository: IQuoteRepository;
  authorRepository: IAuthorRepository;
};

export type RepositoriesProviderProps = {
  children: ReactNode;
  repositories?: Partial<RepositoriesContextType>;
};

const RepositoriesContext = createContext<RepositoriesContextType | undefined>(undefined);

const createDefaultRepositories = (): RepositoriesContextType => ({
  quoteRepository: SupabaseQuoteRepository.getInstance(),
  authorRepository: SupabaseAuthorRepository.getInstance(),
});

/**
 * Provider pour l'injection de dépendances des repositories
 * Permet de centraliser la création des repositories et de les injecter
 */
export const RepositoriesProvider = ({ children, repositories }: RepositoriesProviderProps) => {
  const defaultRepositories = useMemo(() => createDefaultRepositories(), []);
  const value = useMemo(
    () => ({
      ...defaultRepositories,
      ...repositories,
    }),
    [defaultRepositories, repositories]
  );

  return (
    <RepositoriesContext.Provider value={value}>
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
