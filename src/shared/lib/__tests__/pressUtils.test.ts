import { renderHook, act } from '@testing-library/react-native';
import { preventDoublePress, useSinglePress } from '../pressUtils';

describe('pressUtils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('preventDoublePress', () => {
    it('should call function on first invocation and ignore calls within delay', () => {
      const mockFn = jest.fn();
      const debouncedFn = preventDoublePress(mockFn, 500);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');

      // Fast forward time past delay
      jest.advanceTimersByTime(501);

      debouncedFn('fourth');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('fourth');
    });
  });

  describe('useSinglePress', () => {
    it('should ignore duplicate calls within delay window in React components', () => {
      const mockFn = jest.fn();
      const { result } = renderHook(() => useSinglePress(mockFn, 500));

      act(() => {
        result.current();
        result.current();
      });

      expect(mockFn).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(500);
        result.current();
      });

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});
