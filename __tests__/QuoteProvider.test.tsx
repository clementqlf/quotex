import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuoteProvider, useQuote } from '../src/entities/quote/providers/QuoteProvider';
import { SupabaseQuoteRepository } from '../src/entities/quote/api/SupabaseQuoteRepository';
import { RepositoriesProvider } from '../src/app/providers/RepositoriesProvider';
import { Text, Button, View } from 'react-native';

// Mocker le hook de réseau
jest.mock('../src/entities/quote/lib/useNetworkSync', () => ({
  useNetworkSync: () => ({
    isOnline: true,
    isOffline: false,
    pendingCount: 0,
    syncNow: jest.fn(),
    lastSyncTime: null,
  })
}));

jest.mock('../src/entities/quote/api/SupabaseQuoteRepository');
jest.mock('../src/entities/user/api/AuthService', () => ({
  authService: {
    getUser: jest.fn().mockResolvedValue({ id: 'user-123', name: 'Test User' }),
    getToken: jest.fn().mockResolvedValue('mock-token'),
  }
}));

// Composant de test pour utiliser le hook
const TestComponent = () => {
  const { quotes, toggleLikeQuote, addQuote, deleteQuote, updateQuote } = useQuote();

  return (
    <View>
      <Text testID="quote-count">{quotes.length.toString()}</Text>
      {quotes.map(q => (
        <View key={q.id}>
          <Text testID={`quote-text-${q.id}`}>{q.text}</Text>
          <Text testID={`quote-liked-${q.id}`}>{q.isLiked ? 'liked' : 'unliked'}</Text>
          <Button testID={`like-btn-${q.id}`} title="Like" onPress={() => toggleLikeQuote(q.id).catch(() => {})} />
          <Button testID={`delete-btn-${q.id}`} title="Delete" onPress={() => deleteQuote(q.id).catch(() => {})} />
          <Button testID={`update-btn-${q.id}`} title="Update" onPress={() => updateQuote(q.id, { text: 'Updated text' }).catch(() => {})} />
        </View>
      ))}
      <Button testID="add-btn" title="Add" onPress={() => addQuote('Nouvelle citation de test', 'Livre Test')} />
    </View>
  );
};

describe('QuoteProvider Optimistic Updates', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          gcTime: 0,
        }
      },
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RepositoriesProvider>
        <QuoteProvider>
          {children}
        </QuoteProvider>
      </RepositoriesProvider>
    </QueryClientProvider>
  );

  it('devrait mettre à jour le cache de manière optimiste lors de la création d\'une citation', async () => {
    let resolveCreateQuote: any;
    const createQuotePromise = new Promise((resolve) => {
      resolveCreateQuote = resolve;
    });

    const createdQuote = {
      id: 999,
      text: 'Nouvelle citation de test',
      book: 'Livre Test',
      likesCount: 0,
      isLiked: false,
      date: new Date().toISOString(),
      isSaved: false,
      comments: 0,
    };

    const mockRepo = SupabaseQuoteRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getQuotes: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([createdQuote]),
      createQuote: jest.fn().mockReturnValue(createQuotePromise),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    // Initialement, 0 citation
    expect(await findByTestId('quote-count')).toHaveTextContent('0');

    // Action utilisateur
    fireEvent.press(getByTestId('add-btn'));

    // Immédiatement après le clic, l'UI doit refléter la nouvelle citation de manière optimiste (count passe à 1)
    await waitFor(() => {
      expect(getByTestId('quote-count')).toHaveTextContent('1');
    });

    // Résoudre la promesse pour terminer l'action sans laisser d'open handles
    await act(async () => {
      resolveCreateQuote({
        id: 999,
        text: 'Nouvelle citation de test',
        book: 'Livre Test',
        likesCount: 0,
        isLiked: false,
        date: new Date().toISOString(),
        isSaved: false,
        comments: 0,
      });
    });

    // Laisser React Query finir le traitement
    await waitFor(() => {
      expect(getByTestId('quote-count')).toHaveTextContent('1');
    });
  });

  it('devrait annuler (rollback) de manière optimiste si la mutation échoue', async () => {
    const initialQuotes = [{
      id: 1,
      text: 'Citation existante',
      isLiked: false,
      likesCount: 0
    }];

    let rejectToggleLike: any;
    const toggleLikePromise = new Promise((_, reject) => {
      rejectToggleLike = reject;
    });

    const mockRepo = SupabaseQuoteRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getQuotes: jest.fn().mockResolvedValue(initialQuotes),
      toggleLike: jest.fn().mockReturnValue(toggleLikePromise),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    // Initialement
    expect(await findByTestId('quote-liked-1')).toHaveTextContent('unliked');

    // Like optimiste
    fireEvent.press(getByTestId('like-btn-1'));

    // Immédiatement mis à jour
    await waitFor(() => {
      expect(getByTestId('quote-liked-1')).toHaveTextContent('liked');
    });

    // Rejeter la promesse
    await act(async () => {
      rejectToggleLike(new Error('Network error'));
    });

    // L'UI doit rollback à "unliked" car la requête a échoué
    await waitFor(() => {
      expect(getByTestId('quote-liked-1')).toHaveTextContent('unliked');
    });
  });

  it('devrait supprimer de manière optimiste', async () => {
    const initialQuotes = [{
      id: 1,
      text: 'Citation existante',
      isLiked: false,
      likesCount: 0
    }];

    let resolveDeleteQuote: any;
    const deleteQuotePromise = new Promise((resolve) => {
      resolveDeleteQuote = resolve;
    });

    const mockRepo = SupabaseQuoteRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getQuotes: jest.fn().mockResolvedValue(initialQuotes),
      deleteQuote: jest.fn().mockReturnValue(deleteQuotePromise),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    // Attendre que la citation soit chargée
    expect(await findByTestId('quote-text-1')).toHaveTextContent('Citation existante');
    expect(getByTestId('quote-count')).toHaveTextContent('1');

    fireEvent.press(getByTestId('delete-btn-1'));

    // Immédiatement mis à jour
    await waitFor(() => {
      expect(getByTestId('quote-count')).toHaveTextContent('0');
    });

    await act(async () => {
      resolveDeleteQuote();
    });
  });

  it('devrait mettre à jour de manière optimiste', async () => {
    const initialQuotes = [{
      id: 1,
      text: 'Citation existante',
      isLiked: false,
      likesCount: 0
    }];

    let resolveUpdateQuote: any;
    const updateQuotePromise = new Promise((resolve) => {
      resolveUpdateQuote = resolve;
    });

    const mockRepo = SupabaseQuoteRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getQuotes: jest.fn().mockResolvedValue(initialQuotes),
      updateQuote: jest.fn().mockReturnValue(updateQuotePromise),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    expect(await findByTestId('quote-text-1')).toHaveTextContent('Citation existante');

    fireEvent.press(getByTestId('update-btn-1'));

    // Immédiatement mis à jour
    await waitFor(() => {
      expect(getByTestId('quote-text-1')).toHaveTextContent('Updated text');
    });

    await act(async () => {
      resolveUpdateQuote({ ...initialQuotes[0], text: 'Updated text' });
    });
  });
});
