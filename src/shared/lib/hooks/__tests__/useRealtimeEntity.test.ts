import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { useRealtimeEntity } from '../useRealtimeEntity';

// Mock Supabase Realtime
const mockSubscribe = jest.fn().mockReturnThis();
const mockUnsubscribe = jest.fn();
const mockOn = jest.fn().mockReturnThis();

jest.mock('@/src/shared/api/supabase', () => ({
  supabase: {
    channel: jest.fn().mockImplementation(() => ({
      on: mockOn,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
    })),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));

describe('useRealtimeEntity', () => {
  const mockInitialData = { id: 1, name: 'Test Entity', isEnriching: true };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devrait initialiser avec les données initiales', () => {
    const { result } = renderHook(() =>
      useRealtimeEntity({
        id: 1,
        initialData: mockInitialData,
        table: 'TestTable',
      })
    );

    expect(result.current).toEqual(mockInitialData);
  });

  it('devrait initialiser avec null si aucune donnée initiale', () => {
    const { result } = renderHook(() =>
      useRealtimeEntity({
        id: 1,
        initialData: null,
        table: 'TestTable',
      })
    );

    expect(result.current).toBeNull();
  });

  it('devrait s\'abonner au canal Supabase avec le bon nom de table et ID', () => {
    renderHook(() =>
      useRealtimeEntity({
        id: 42,
        initialData: mockInitialData,
        table: 'quotes',
      })
    );

    expect(mockOn).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('devrait se désabonner lors du démontage', () => {
    const { unmount } = renderHook(() =>
      useRealtimeEntity({
        id: 1,
        initialData: mockInitialData,
        table: 'TestTable',
      })
    );

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('devrait mettre à jour les données lorsqu\'un événement INSERT est reçu', () => {
    const { result } = renderHook(() =>
      useRealtimeEntity({
        id: 1,
        initialData: mockInitialData,
        table: 'TestTable',
      })
    );

    // Simuler un événement INSERT
    const mockPayload = { new: { id: 1, name: 'Updated Entity', isEnriching: false } };
    const mockEvent = {
      type: 'INSERT',
      new: mockPayload.new,
      old: null,
    };

    act(() => {
      mockOn.mock.calls[0][2](mockEvent);
    });

    expect(result.current).toEqual(mockPayload.new);
  });

  it('devrait mettre à jour les données lorsqu\'un événement UPDATE est reçu', () => {
    const { result } = renderHook(() =>
      useRealtimeEntity({
        id: 1,
        initialData: mockInitialData,
        table: 'TestTable',
      })
    );

    // Simuler un événement UPDATE
    const mockPayload = { new: { id: 1, name: 'Updated Entity', isEnriching: false } };
    const mockEvent = {
      type: 'UPDATE',
      new: mockPayload.new,
      old: mockInitialData,
    };

    act(() => {
      mockOn.mock.calls[0][2](mockEvent);
    });

    expect(result.current).toEqual(mockPayload.new);
  });

  it('devrait mettre à jour les données lorsqu\'un événement DELETE est reçu', () => {
    const { result } = renderHook(() =>
      useRealtimeEntity({
        id: 1,
        initialData: mockInitialData,
        table: 'TestTable',
      })
    );

    // Simuler un événement DELETE
    const mockEvent = {
      type: 'DELETE',
      new: null,
      old: mockInitialData,
    };

    act(() => {
      mockOn.mock.calls[0][2](mockEvent);
    });

    expect(result.current).toBeNull();
  });

  it('devrait gérer les changements d\'ID', () => {
    const { rerender } = renderHook(
      ({ id }: { id: number }) =>
        useRealtimeEntity({
          id,
          initialData: mockInitialData,
          table: 'TestTable',
        }),
      { initialProps: { id: 1 } }
    );

    // Changer l'ID
    rerender({ id: 2 });

    // Devrait s'abonner à un nouveau canal
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalledTimes(2);
  });
});
