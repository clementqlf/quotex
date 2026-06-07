import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthorProvider, useAuthor } from '../src/entities/author/providers/AuthorProvider';
import { SupabaseAuthorRepository } from '../src/entities/author/api/SupabaseAuthorRepository';
import { Text, Button, View } from 'react-native';

jest.mock('../src/entities/author/api/SupabaseAuthorRepository');

const TestComponent = () => {
  const { 
    authors, 
    books, 
    toggleSaveAuthor, 
    toggleSaveBook, 
    updateBookStatus 
  } = useAuthor();

  return (
    <View>
      <Text testID="author-count">{authors.length.toString()}</Text>
      {authors.map(a => (
        <View key={a.id}>
          <Text testID={`author-name-${a.id}`}>{a.name}</Text>
          <Text testID={`author-saved-${a.id}`}>{a.isSaved ? 'saved' : 'unsaved'}</Text>
          <Button testID={`save-author-btn-${a.id}`} title="Save Author" onPress={() => toggleSaveAuthor(a.id as number).catch(() => {})} />
        </View>
      ))}

      <Text testID="book-count">{books.length.toString()}</Text>
      {books.map(b => (
        <View key={b.id}>
          <Text testID={`book-title-${b.id}`}>{b.title}</Text>
          <Text testID={`book-saved-${b.id}`}>{b.isSaved ? 'saved' : 'unsaved'}</Text>
          <Text testID={`book-status-${b.id}`}>{b.readingStatus}</Text>
          <Button testID={`save-book-btn-${b.id}`} title="Save Book" onPress={() => toggleSaveBook(b.id as number).catch(() => {})} />
          <Button testID={`status-book-btn-${b.id}`} title="Update Status" onPress={() => updateBookStatus(b.id as number, 'read' as any).catch(() => {})} />
        </View>
      ))}
    </View>
  );
};

describe('AuthorProvider Optimistic Updates', () => {
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
      <AuthorProvider>
        {children}
      </AuthorProvider>
    </QueryClientProvider>
  );

  it('devrait rendre l\'état initial vide', async () => {
    const mockRepo = SupabaseAuthorRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getAuthors: jest.fn().mockResolvedValue([]),
      getBooks: jest.fn().mockResolvedValue([]),
    });

    const { findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    expect(await findByTestId('author-count')).toHaveTextContent('0');
    expect(await findByTestId('book-count')).toHaveTextContent('0');
  });

  it('devrait mettre à jour de manière optimiste lors de la sauvegarde d\'un livre', async () => {
    const initialBooks = [{ id: 1, title: 'Livre 1', isSaved: false, readingStatus: 'to-read' }];
    
    let resolveToggleSaveBook: any;
    const toggleSaveBookPromise = new Promise((resolve) => {
      resolveToggleSaveBook = resolve;
    });

    const mockRepo = SupabaseAuthorRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getAuthors: jest.fn().mockResolvedValue([]),
      getBooks: jest.fn().mockResolvedValue(initialBooks),
      toggleSaveBook: jest.fn().mockReturnValue(toggleSaveBookPromise),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    expect(await findByTestId('book-saved-1')).toHaveTextContent('unsaved');

    fireEvent.press(getByTestId('save-book-btn-1'));

    // Optimistic UI update
    await waitFor(() => {
      expect(getByTestId('book-saved-1')).toHaveTextContent('saved');
    });

    await waitFor(async () => {
      resolveToggleSaveBook();
    });
  });

  it('devrait mettre à jour de manière optimiste lors du changement de statut de lecture d\'un livre', async () => {
    const initialBooks = [{ id: 1, title: 'Livre 1', isSaved: false, readingStatus: 'to-read' }];
    
    let resolveUpdateBookStatus: any;
    const updateBookStatusPromise = new Promise((resolve) => {
      resolveUpdateBookStatus = resolve;
    });

    const mockRepo = SupabaseAuthorRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getAuthors: jest.fn().mockResolvedValue([]),
      getBooks: jest.fn().mockResolvedValue(initialBooks),
      updateBookStatus: jest.fn().mockReturnValue(updateBookStatusPromise),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    expect(await findByTestId('book-status-1')).toHaveTextContent('to-read');

    fireEvent.press(getByTestId('status-book-btn-1'));

    // Optimistic UI update
    await waitFor(() => {
      expect(getByTestId('book-status-1')).toHaveTextContent('read');
    });

    await waitFor(async () => {
      resolveUpdateBookStatus();
    });
  });

  it('devrait annuler (rollback) de manière optimiste la sauvegarde d\'un livre si la mutation échoue', async () => {
    const initialBooks = [{ id: 1, title: 'Livre 1', isSaved: false, readingStatus: 'to-read' }];
    
    let rejectToggleSaveBook: any;
    const toggleSaveBookPromise = new Promise((_, reject) => {
      rejectToggleSaveBook = reject;
    });

    const mockRepo = SupabaseAuthorRepository.getInstance as jest.Mock;
    mockRepo.mockReturnValue({
      getAuthors: jest.fn().mockResolvedValue([]),
      getBooks: jest.fn().mockResolvedValue(initialBooks),
      toggleSaveBook: jest.fn().mockReturnValue(toggleSaveBookPromise),
    });

    const { getByTestId, findByTestId } = render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    expect(await findByTestId('book-saved-1')).toHaveTextContent('unsaved');

    fireEvent.press(getByTestId('save-book-btn-1'));

    // Optimistic UI update
    await waitFor(() => {
      expect(getByTestId('book-saved-1')).toHaveTextContent('saved');
    });

    await waitFor(async () => {
      rejectToggleSaveBook(new Error('API Error'));
    });

    // Rollback
    await waitFor(() => {
      expect(getByTestId('book-saved-1')).toHaveTextContent('unsaved');
    });
  });
});
