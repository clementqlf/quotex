import { getExponentialBackoff } from './backoff';

describe('backoff calculation', () => {
  it('should calculate exponential delay based on retry attempt', () => {
    // 2^0 * 1000 = 1000
    expect(getExponentialBackoff(0)).toBe(1000);
    // 2^1 * 1000 = 2000
    expect(getExponentialBackoff(1)).toBe(2000);
    // 2^2 * 1000 = 4000
    expect(getExponentialBackoff(2)).toBe(4000);
    // 2^3 * 1000 = 8000
    expect(getExponentialBackoff(3)).toBe(8000);
  });

  it('should cap the delay at maxDelay', () => {
    // Default maxDelay is 60000
    // 2^6 * 1000 = 64000 -> capped at 60000
    expect(getExponentialBackoff(6)).toBe(60000);
    expect(getExponentialBackoff(10)).toBe(60000);
  });

  it('should honor custom maxDelay values', () => {
    const customMaxDelay = 5000;
    expect(getExponentialBackoff(2, customMaxDelay)).toBe(4000);
    expect(getExponentialBackoff(3, customMaxDelay)).toBe(customMaxDelay);
    expect(getExponentialBackoff(10, customMaxDelay)).toBe(customMaxDelay);
  });
});
