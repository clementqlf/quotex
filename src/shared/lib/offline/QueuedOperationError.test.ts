import { QueuedOperationError } from './QueuedOperationError';

describe('QueuedOperationError', () => {
  it('should initialize with correct properties, name and message', () => {
    const mockResult = { isSaved: true, savedAt: '2026-06-27T20:00:00Z', likesCount: 42 };
    const error = new QueuedOperationError(mockResult);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(QueuedOperationError);
    expect(error.name).toBe('QueuedOperationError');
    expect(error.message).toBe('Operation queued for offline sync');
    expect(error._isQueued).toBe(true);
    expect(error.result).toEqual(mockResult);
  });

  describe('static is (type guard)', () => {
    it('should return true for instances of QueuedOperationError', () => {
      const error = new QueuedOperationError({ isSaved: true });
      expect(QueuedOperationError.is(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Some error');
      expect(QueuedOperationError.is(error)).toBe(false);
    });

    it('should return false for other values (null, undefined, strings, objects)', () => {
      expect(QueuedOperationError.is(null)).toBe(false);
      expect(QueuedOperationError.is(undefined)).toBe(false);
      expect(QueuedOperationError.is('error')).toBe(false);
      expect(QueuedOperationError.is({ message: 'Operation queued for offline sync' })).toBe(false);
    });
  });
});
