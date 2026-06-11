import { isOffline, isNetworkError, logFetchError } from '../networkUtils';
import NetInfo from '@react-native-community/netinfo';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

describe('networkUtils', () => {
  describe('isOffline', () => {
    it('should return true if not connected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false
      });
      expect(await isOffline()).toBe(true);
    });

    it('should return false if connected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true
      });
      expect(await isOffline()).toBe(false);
    });

    it('should return false if NetInfo fails', async () => {
      (NetInfo.fetch as jest.Mock).mockRejectedValue(new Error('Failed'));
      expect(await isOffline()).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should detect network errors', () => {
      expect(isNetworkError(new Error('Network request failed'))).toBe(true);
      expect(isNetworkError(new Error('NetworkError when fetching'))).toBe(true);
      expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
      expect(isNetworkError(new Error('Aborted'))).toBe(true);
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      expect(isNetworkError(abortError)).toBe(true);
    });

    it('should return false for non-network errors', () => {
      expect(isNetworkError(new Error('Invalid data'))).toBe(false);
      expect(isNetworkError(new Error('Validation failed'))).toBe(false);
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });
  });

  describe('logFetchError', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    afterEach(() => {
      consoleWarnSpy.mockClear();
      consoleErrorSpy.mockClear();
    });

    it('should log warning for network errors', () => {
      const networkErr = new Error('Network request failed');
      logFetchError('API call', networkErr);
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log error for non-network errors', () => {
      const otherErr = new Error('Invalid data');
      logFetchError('API call', otherErr);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
