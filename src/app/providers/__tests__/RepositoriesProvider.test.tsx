import { IAuthorRepository } from '@/src/entities/author/api/IAuthorRepository';
import { IQuoteRepository } from '@/src/entities/quote/api/IQuoteRepository';
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { RepositoriesProvider, useRepositories } from '../RepositoriesProvider';

jest.mock('@/src/entities/quote/api/SupabaseQuoteRepository', () => ({
  SupabaseQuoteRepository: {
    getInstance: jest.fn(),
  },
}));

jest.mock('@/src/entities/author/api/SupabaseAuthorRepository', () => ({
  SupabaseAuthorRepository: {
    getInstance: jest.fn(),
  },
}));

describe('RepositoriesProvider', () => {
  const quoteRepository = {
    getQuotes: jest.fn(),
    getQuoteById: jest.fn(),
    createQuote: jest.fn(),
    updateQuote: jest.fn(),
    deleteQuote: jest.fn(),
    toggleLike: jest.fn(),
    toggleSave: jest.fn(),
    getUserQuotes: jest.fn(),
    getUserByUsername: jest.fn(),
  } as unknown as IQuoteRepository;

  const authorRepository = {
    getAuthors: jest.fn(),
    getAuthorById: jest.fn(),
    getAuthorByName: jest.fn(),
    getBooks: jest.fn(),
    getBooksByAuthor: jest.fn(),
    getBookByTitle: jest.fn(),
    getBookById: jest.fn(),
    getBookByInventaireUri: jest.fn(),
    toggleSaveAuthor: jest.fn(),
    toggleSaveBook: jest.fn(),
    updateBookStatus: jest.fn(),
    getNotableWorks: jest.fn(),
    importBook: jest.fn(),
  } as unknown as IAuthorRepository;

  const mockedQuoteRepositoryGetInstance = jest.requireMock('@/src/entities/quote/api/SupabaseQuoteRepository').SupabaseQuoteRepository.getInstance as jest.Mock;
  const mockedAuthorRepositoryGetInstance = jest.requireMock('@/src/entities/author/api/SupabaseAuthorRepository').SupabaseAuthorRepository.getInstance as jest.Mock;

  beforeEach(() => {
    mockedQuoteRepositoryGetInstance.mockReturnValue(quoteRepository);
    mockedAuthorRepositoryGetInstance.mockReturnValue(authorRepository);
  });

  function Consumer() {
    const repositories = useRepositories();

    return (
      <Text>
        {repositories.quoteRepository === quoteRepository && repositories.authorRepository === authorRepository
          ? 'injected'
          : 'default'}
      </Text>
    );
  }

  it('expose les repositories injectés dans le contexte', async () => {
    const { getByText } = render(
      <RepositoriesProvider repositories={{ quoteRepository, authorRepository }}>
        <Consumer />
      </RepositoriesProvider>
    );

    await waitFor(() => {
      expect(getByText('injected')).toBeTruthy();
    });
  });
});
