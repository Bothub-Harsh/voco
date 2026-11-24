import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isKeepAliveActive,
  getNextWindowStart,
  parseKeepAliveConfig,
  getKeepAliveStatus,
  setupSelfKeepAlive,
  stopSelfKeepAlive,
} from '../server/keepalive.js';

describe('Server Keep-Alive Daytime Schedule & Edge Cases', () => {
  const defaultConfig = {
    start: '07:00',
    end: '23:00',
    timeZone: 'Asia/Kolkata',
    intervalMinutes: 10,
  };

  // Asia/Kolkata is UTC + 5:30
  // 07:00 IST = 01:30 UTC
  // 23:00 IST = 17:30 UTC
  // 12:00 IST = 06:30 UTC

  it('verifies exact edge cases: 6:59 AM, 7:00 AM, 10:59 PM, 11:00 PM, and midnight IST', () => {
    // 06:59 AM IST -> 01:29 UTC
    const at0659 = new Date('2026-11-22T01:29:00.000Z');
    expect(isKeepAliveActive(at0659, defaultConfig)).toBe(false);

    // 07:00 AM IST -> 01:30 UTC (exact start: ACTIVE)
    const at0700 = new Date('2026-11-22T01:30:00.000Z');
    expect(isKeepAliveActive(at0700, defaultConfig)).toBe(true);

    // 10:59 PM IST (22:59) -> 17:29 UTC (ACTIVE)
    const at2259 = new Date('2026-11-22T17:29:00.000Z');
    expect(isKeepAliveActive(at2259, defaultConfig)).toBe(true);

    // 11:00 PM IST (23:00) -> 17:30 UTC (exact end of [start, end): INACTIVE / night)
    const at2300 = new Date('2026-11-22T17:30:00.000Z');
    expect(isKeepAliveActive(at2300, defaultConfig)).toBe(false);

    // Midnight IST (00:00) -> 18:30 UTC previous day (INACTIVE / night)
    const atMidnight = new Date('2026-11-22T18:30:00.000Z');
    expect(isKeepAliveActive(atMidnight, defaultConfig)).toBe(false);

    // 02:00 AM IST -> 20:30 UTC previous day (INACTIVE / night)
    const at0200 = new Date('2026-11-22T20:30:00.000Z');
    expect(isKeepAliveActive(at0200, defaultConfig)).toBe(false);
  });

  it('handles midnight-crossing window (e.g. 22:00 to 06:00)', () => {
    const crossConfig = {
      start: '22:00',
      end: '06:00',
      timeZone: 'Asia/Kolkata',
      intervalMinutes: 10,
    };

    // 21:59 IST (16:29 UTC) -> outside
    expect(isKeepAliveActive(new Date('2026-11-22T16:29:00.000Z'), crossConfig)).toBe(false);

    // 22:00 IST (16:30 UTC) -> active start
    expect(isKeepAliveActive(new Date('2026-11-22T16:30:00.000Z'), crossConfig)).toBe(true);

    // Midnight IST (18:30 UTC) -> active
    expect(isKeepAliveActive(new Date('2026-11-22T18:30:00.000Z'), crossConfig)).toBe(true);

    // 05:59 IST (00:29 UTC next day) -> active
    expect(isKeepAliveActive(new Date('2026-11-23T00:29:00.000Z'), crossConfig)).toBe(true);

    // 06:00 IST (00:30 UTC next day) -> inactive (end boundary)
    expect(isKeepAliveActive(new Date('2026-11-23T00:30:00.000Z'), crossConfig)).toBe(false);
  });

  it('parses config safely with fallbacks on missing or invalid environment variables', () => {
    const parsedValid = parseKeepAliveConfig({
      KEEPALIVE_START: '08:15',
      KEEPALIVE_END: '22:45',
      KEEPALIVE_TZ: 'UTC',
      KEEPALIVE_INTERVAL_MIN: '5',
    });
    expect(parsedValid).toEqual({
      start: '08:15',
      end: '22:45',
      timeZone: 'UTC',
      intervalMinutes: 5,
    });

    // Invalid values
    const parsedInvalid = parseKeepAliveConfig({
      KEEPALIVE_START: 'invalid',
      KEEPALIVE_END: '25:00',
      KEEPALIVE_TZ: 'Mars/Phobos',
      KEEPALIVE_INTERVAL_MIN: 'not_a_number',
    });
    expect(parsedInvalid).toEqual({
      start: '07:00',
      end: '23:00',
      timeZone: 'Asia/Kolkata',
      intervalMinutes: 10,
    });
  });

  it('calculates correct nextWindowStart when at night', () => {
    // Current time: 23:30 IST on Nov 22 (18:00 UTC)
    const nightTime = new Date('2026-11-22T18:00:00.000Z');
    const nextStart = getNextWindowStart(nightTime, defaultConfig);
    // Next start should be Nov 23 at 07:00 IST = 2026-11-23T01:30:00.000Z
    expect(nextStart).toBe('2026-11-23T01:30:00.000Z');

    // Inside window: 10:00 AM IST (04:30 UTC)
    const dayTime = new Date('2026-11-22T04:30:00.000Z');
    expect(getNextWindowStart(dayTime, defaultConfig)).toBe(null);
  });

  it('returns structured getKeepAliveStatus with enabledWindow, activeNow, nextWindowStart', () => {
    const nightTime = new Date('2026-11-22T18:00:00.000Z');
    const statusNight = getKeepAliveStatus(nightTime, defaultConfig);
    expect(statusNight.activeNow).toBe(false);
    expect(statusNight.enabledWindow).toBe('07:00-23:00');
    expect(statusNight.timezone).toBe('Asia/Kolkata');
    expect(statusNight.nextWindowStart).toBe('2026-11-23T01:30:00.000Z');

    const dayTime = new Date('2026-11-22T04:30:00.000Z');
    const statusDay = getKeepAliveStatus(dayTime, defaultConfig);
    expect(statusDay.activeNow).toBe(true);
    expect(statusDay.nextWindowStart).toBe(null);
  });

  describe('Self-ping timer lifecycle & window enforcement', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      stopSelfKeepAlive();
      vi.useRealTimers();
    });

    it('ensures only ONE timer runs, skipping pings at night and pinging during the day', async () => {
      let simulatedTime = new Date('2026-11-22T18:00:00.000Z'); // 23:30 IST (night)
      const mockFetch = vi.fn().mockResolvedValue({ status: 200 });

      // Start timer with 10-minute interval
      const timer1 = setupSelfKeepAlive({
        externalUrl: 'https://voco-backend.onrender.com',
        config: defaultConfig,
        intervalMs: 10000, // 10s for test speed
        clock: () => simulatedTime,
        fetch: mockFetch,
      });

      expect(timer1).toBeDefined();

      // Calling setupSelfKeepAlive again replaces the timer (never duplicates)
      const timer2 = setupSelfKeepAlive({
        externalUrl: 'https://voco-backend.onrender.com',
        config: defaultConfig,
        intervalMs: 10000,
        clock: () => simulatedTime,
        fetch: mockFetch,
      });

      expect(timer2).toBeDefined();

      // Advance timer by 10s while it is night
      await vi.advanceTimersByTimeAsync(10000);
      // Fetch should NOT have been called because it is night
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance clock to morning: 07:15 IST (01:45 UTC)
      simulatedTime = new Date('2026-11-23T01:45:00.000Z');
      await vi.advanceTimersByTimeAsync(10000);

      // Now it's daytime, fetch SHOULD be called exactly once
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://voco-backend.onrender.com/health',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });
});
