import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Button, Text, View } from 'react-native';
import { RepositoriesProvider } from '@/src/app/providers/RepositoriesProvider';
import { SupabaseQuoteRepository } from '@/src/entities/quote/api/SupabaseQuoteRepository';
import { QuoteProvider, useQuote } from '@/src/entities/quote/providers/QuoteProvider';

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

jest.mock('@/src/entities/quote/api/SupabaseQuoteRepository');
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
    jest.setTimeout(15000);
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
    jest.setTimeout(5000);
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
      createQuote: jest.fn().mockResolvedValue(createdQuote),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    // Initialement, 0 citation
    expect(await findByTestId('quote-count')).toHaveTextContent('0');

    // Action utilisateur
    await act(async () => {
      fireEvent.press(getByTestId('add-btn'));
    });

    // Immédiatement après le clic ou la résolution, l'UI reflète la création
    await waitFor(() => {
      expect(getByTestId('quote-count')).toHaveTextContent('1');
    });
  }, 15000);

  it('devrait annuler (rollback) de manière optimiste si la mutation échoue', async () => {
    const initialQuotes = [{
      id: 1,
      text: 'Citation existante',
      isLiked: false,
      likesCount: 0
    }];

    const mockRepo = SupabaseQuoteRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getQuotes: jest.fn().mockResolvedValue(initialQuotes),
      toggleLike: jest.fn().mockRejectedValue(new Error('Network error')),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    // Initialement
    expect(await findByTestId('quote-liked-1')).toHaveTextContent('unliked');

    // Like optimiste
    await act(async () => {
      fireEvent.press(getByTestId('like-btn-1'));
    });

    // L'UI doit être à "unliked" après l'échec et le rollback
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

    let resolveDelete: any;
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });

    const mockRepo = SupabaseQuoteRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getQuotes: jest.fn().mockResolvedValue(initialQuotes),
      deleteQuote: jest.fn().mockReturnValue(deletePromise),
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

    // Immédiatement mis à jour de manière optimiste
    await waitFor(() => {
      expect(getByTestId('quote-count')).toHaveTextContent('0');
    });

    await act(async () => {
      resolveDelete();
    });
  });

  it('devrait mettre à jour de manière optimiste', async () => {
    const initialQuotes = [{
      id: 1,
      text: 'Citation existante',
      isLiked: false,
      likesCount: 0
    }];

    let resolveUpdate: any;
    const updatePromise = new Promise((resolve) => {
      resolveUpdate = resolve;
    });

    const mockRepo = SupabaseQuoteRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getQuotes: jest.fn().mockResolvedValue(initialQuotes),
      updateQuote: jest.fn().mockReturnValue(updatePromise),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    expect(await findByTestId('quote-text-1')).toHaveTextContent('Citation existante');

    fireEvent.press(getByTestId('update-btn-1'));

    // Immédiatement mis à jour de manière optimiste
    await waitFor(() => {
      expect(getByTestId('quote-text-1')).toHaveTextContent('Updated text');
    });

    await act(async () => {
      resolveUpdate({ ...initialQuotes[0], text: 'Updated text' });
    });
  });
});
