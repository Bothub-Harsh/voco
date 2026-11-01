import { describe, it, expect } from 'vitest';
import {
  isNetworkOrOfflineError,
  classifyError,
  refreshVocabularyFromAI,
} from '../src/services/api';

describe('Network Status & Error Handling', () => {
  it('identifies network failures, drops, and timeouts accurately', () => {
    expect(isNetworkOrOfflineError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkOrOfflineError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isNetworkOrOfflineError(new Error('Network timeout after 40s'))).toBe(true);
    expect(isNetworkOrOfflineError(new Error('connect ECONNREFUSED 127.0.0.1:3001'))).toBe(true);
    expect(isNetworkOrOfflineError(new Error('No internet connection. Please check your network.'))).toBe(true);

    // Non-network errors return false
    expect(isNetworkOrOfflineError(new Error('Rate limit (429)'))).toBe(false);
    expect(isNetworkOrOfflineError(new Error('Server error (500)'))).toBe(false);
  });

  it('classifies network errors with clear user-friendly guidance', () => {
    const fetchFailure = classifyError(new TypeError('Failed to fetch'), 'Ephemeral');
    expect(fetchFailure.type).toBe('NETWORK_FAILURE');
    expect(fetchFailure.reason).toBe('No internet connection. Please check your network.');

    const timeoutFailure = classifyError(new Error('Request timeout after 40s'), 'Tenacious');
    expect(timeoutFailure.type).toBe('NETWORK_FAILURE');
    expect(timeoutFailure.reason).toBe('No internet connection. Please check your network.');
  });

  it('throws friendly network message when refresh fails due to network drop', async () => {
    // When fetch fails with network drop, refreshVocabularyFromAI must throw clear message
    try {
      await refreshVocabularyFromAI('Compelled', 'Old meaning');
      expect.unreachable('Should have thrown network error');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain('No internet connection. Please check your network.');
    }
  });
});
