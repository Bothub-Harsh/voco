import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkBackendStatus } from '../src/services/api';
import type { BackendStatus } from '../src/types';

describe('Frontend Backend Status Handling — All 6 Core Scenarios', () => {
  const originalFetch = globalThis.fetch;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  // Situation 1: Backend responds immediately
  it('Situation 1: Backend responds immediately when warm and active', async () => {
    const states: BackendStatus[] = [];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        configured: true,
        model: 'openai/gpt-oss-120b',
        message: 'Groq API key is configured.',
      }),
    });

    const promise = checkBackendStatus((status) => states.push({ ...status }));
    const result = await promise;

    expect(result.reachable).toBe(true);
    expect(result.state).toBe('connected');
    expect(result.message).toBe('Backend connected.');
    expect(result.configured).toBe(true);
    expect(result.model).toBe('openai/gpt-oss-120b');

    // Transitions from checking directly to connected
    expect(states[0].state).toBe('checking');
    expect(states[0].message).toBe('Checking connection...');
    expect(states[states.length - 1].state).toBe('connected');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  // Situation 2: Backend takes a long time to start (Render cold start)
  it('Situation 2: Backend takes a long time to start (times out initially, then succeeds)', async () => {
    const states: BackendStatus[] = [];
    let callCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First attempt times out (AbortError) because container is booting
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
      // Second attempt succeeds after container finishes spinning up
      return {
        ok: true,
        status: 200,
        json: async () => ({
          configured: true,
          model: 'openai/gpt-oss-120b',
        }),
      };
    });

    const promise = checkBackendStatus((status) => states.push({ ...status }));

    // Advance timers for the 3s retry backoff delay
    await vi.advanceTimersByTimeAsync(3500);
    const result = await promise;

    expect(result.reachable).toBe(true);
    expect(result.state).toBe('connected');
    expect(callCount).toBe(2);

    // Emits checking -> waking ("Backend is waking up...") -> connected
    const stateNames = states.map((s) => s.state);
    expect(stateNames).toContain('checking');
    expect(stateNames).toContain('waking');
    expect(stateNames).toContain('connected');

    const wakingState = states.find((s) => s.state === 'waking');
    expect(wakingState?.message).toBe('Backend is waking up...');
    expect(wakingState?.reachable).toBe(false);
  });

  // Situation 3: Backend is temporarily unavailable (502 / 503 gateway responses)
  it('Situation 3: Backend is temporarily unavailable (exhausts retries without infinite loops)', async () => {
    const states: BackendStatus[] = [];
    let callCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return { ok: false, status: 503 };
    });

    const promise = checkBackendStatus((status) => states.push({ ...status }));

    // Advance past retry backoff timers (3 attempts total)
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(4000);
    const result = await promise;

    expect(result.reachable).toBe(false);
    expect(result.state).toBe('unavailable');
    expect(result.message).toBe('Backend unavailable. Please try again.');

    // Enforces strict limit of 3 attempts: No infinite loop
    expect(callCount).toBe(3);
    const wakingCount = states.filter((s) => s.state === 'waking').length;
    expect(wakingCount).toBeGreaterThanOrEqual(1);
  });

  // Situation 4: Backend returns a permanent client error (e.g. 404 Not Found)
  it('Situation 4: Backend returns a permanent client error (stops without redundant retries)', async () => {
    const states: BackendStatus[] = [];
    let callCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return { ok: false, status: 404 };
    });

    const promise = checkBackendStatus((status) => states.push({ ...status }));
    const result = await promise;

    expect(result.reachable).toBe(false);
    expect(result.state).toBe('unavailable');
    expect(result.message).toBe('Backend unavailable. Please try again.');

    // 4xx errors should fail fast without wasting retries
    expect(callCount).toBe(1);
  });

  // Situation 5: Internet connection is completely unavailable
  it('Situation 5: Internet connection is unavailable (immediate offline status, 0 network calls)', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const states: BackendStatus[] = [];
    const result = await checkBackendStatus((status) => states.push({ ...status }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.reachable).toBe(false);
    expect(result.state).toBe('unavailable');
    expect(result.message).toBe('No internet connection. Please check your network.');
    expect(states[0].message).toBe('No internet connection. Please check your network.');
  });

  // Situation 6: Backend becomes available after an initial network failure
  it('Situation 6: Backend becomes available after an initial network glitch', async () => {
    const states: BackendStatus[] = [];
    let callCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          configured: true,
          model: 'openai/gpt-oss-120b',
        }),
      };
    });

    const promise = checkBackendStatus((status) => states.push({ ...status }));

    // Advance through the backoff timer
    await vi.advanceTimersByTimeAsync(3500);
    const result = await promise;

    expect(result.reachable).toBe(true);
    expect(result.state).toBe('connected');
    expect(callCount).toBe(2);

    // Transitions through checking -> waking -> connected
    const stateNames = states.map((s) => s.state);
    expect(stateNames).toEqual(['checking', 'waking', 'connected']);
  });

  // Situation 7: Backend returns detailed health telemetry
  it('Situation 7: Backend returns detailed health telemetry (uptime, timestamps, response time)', async () => {
    const fakeStartTime = '2026-11-21T07:00:00.000Z';
    const fakeServerTime = '2026-11-21T13:00:00.000Z';
    const fakePingTime = '2026-11-21T12:50:00.000Z';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        service: 'my-vocabulary-backend',
        startTime: fakeStartTime,
        uptimeSeconds: 21600,
        serverTime: fakeServerTime,
        configured: true,
        model: 'openai/gpt-oss-120b',
        lastSelfPingAt: fakePingTime,
      }),
    });

    const result = await checkBackendStatus();

    expect(result.reachable).toBe(true);
    expect(result.state).toBe('connected');
    expect(result.configured).toBe(true);
    expect(result.model).toBe('openai/gpt-oss-120b');
    expect(result.serverStartTime).toBe(fakeStartTime);
    expect(result.serverTime).toBe(fakeServerTime);
    expect(result.uptimeSeconds).toBe(21600);
    expect(result.lastPingAt).toBe(fakePingTime);
    expect(typeof result.responseTimeMs).toBe('number');
    expect(typeof result.lastCheckedAt).toBe('number');
  });

  // Situation 8: Groq is unconfigured on the server
  it('Situation 8: Groq API key unconfigured returns ai_problem state', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        configured: false,
        model: 'openai/gpt-oss-120b',
        message: 'GROQ_API_KEY not configured.',
      }),
    });

    const result = await checkBackendStatus();

    expect(result.reachable).toBe(true);
    expect(result.state).toBe('ai_problem');
    expect(result.configured).toBe(false);
    expect(result.message).toContain('Groq API key is not configured');
  });

  // Situation 9: Concurrent status checks are properly deduplicated
  it('Situation 9: Deduplicates concurrent status checks to avoid duplicate requests', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          configured: true,
          model: 'openai/gpt-oss-120b',
        }),
      };
    });

    // Fire 3 calls concurrently
    const [res1, res2, res3] = await Promise.all([
      checkBackendStatus(),
      checkBackendStatus(),
      checkBackendStatus(),
    ]);

    expect(callCount).toBe(1);
    expect(res1.reachable).toBe(true);
    expect(res2.reachable).toBe(true);
    expect(res3.reachable).toBe(true);
  });
});
