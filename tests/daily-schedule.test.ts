import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_DAILY_SCHEDULE,
  formatTime12h,
  isOvernightWindow,
  getIsoDayOfWeek,
  isInsideDailyScheduleWindow,
  computeDailyScheduleStatus,
  getDailyScheduleConfig,
  setDailyScheduleConfig,
  markSchedulePausedToday,
  clearSchedulePausedToday,
  saveDailySchedule,
} from '../src/services/notifications';
import type { DailyScheduleConfig } from '../src/types';

describe('Daily Schedule Service — Complete Unit Tests', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    };
  });

  // 1. Defaults
  it('loads default daily schedule correctly', () => {
    const config = getDailyScheduleConfig();
    expect(config.enabled).toBe(false);
    expect(config.startTime).toBe('08:00');
    expect(config.endTime).toBe('21:00');
    expect(config.days).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(config.notifyOnStartEnd).toBe(true);
    expect(config.pausedDate).toBeNull();
  });

  // 2. Time 12h formatting
  it('formats 24-hour time strings into clean 12-hour strings', () => {
    expect(formatTime12h('08:00')).toBe('8:00 AM');
    expect(formatTime12h('00:00')).toBe('12:00 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('13:30')).toBe('1:30 PM');
    expect(formatTime12h('21:00')).toBe('9:00 PM');
    expect(formatTime12h('23:45')).toBe('11:45 PM');
  });

  // 3. Overnight window detection
  it('detects overnight windows vs daytime windows correctly', () => {
    expect(isOvernightWindow('08:00', '21:00')).toBe(false);
    expect(isOvernightWindow('09:30', '18:00')).toBe(false);
    expect(isOvernightWindow('22:00', '02:00')).toBe(true);
    expect(isOvernightWindow('21:00', '08:00')).toBe(true);
    expect(isOvernightWindow('10:00', '10:00')).toBe(false);
  });

  // 4. ISO Day calculations (1=Mon, 7=Sun)
  it('maps calendar days correctly to ISO 1=Mon .. 7=Sun', () => {
    // 2026-11-21 is Saturday -> ISO day 6
    const saturday = new Date(2026, 10, 21, 10, 0, 0);
    expect(getIsoDayOfWeek(saturday)).toBe(6);

    // 2026-11-22 is Sunday -> ISO day 7
    const sunday = new Date(2026, 10, 22, 10, 0, 0);
    expect(getIsoDayOfWeek(sunday)).toBe(7);

    // 2026-11-23 is Monday -> ISO day 1
    const monday = new Date(2026, 10, 23, 10, 0, 0);
    expect(getIsoDayOfWeek(monday)).toBe(1);
  });

  // 5. Normal daytime window checking
  it('accurately identifies whether a time is inside a daytime schedule window', () => {
    const config: DailyScheduleConfig = {
      enabled: true,
      startTime: '08:00',
      endTime: '21:00',
      days: [1, 2, 3, 4, 5], // Monday through Friday
      notifyOnStartEnd: true,
    };

    // Monday (day 1) at 10:30 AM -> inside
    const mondayMorning = new Date(2026, 10, 23, 10, 30, 0);
    expect(isInsideDailyScheduleWindow(config, mondayMorning)).toBe(true);

    // Monday at 7:45 AM -> before window
    const mondayEarly = new Date(2026, 10, 23, 7, 45, 0);
    expect(isInsideDailyScheduleWindow(config, mondayEarly)).toBe(false);

    // Monday at 9:15 PM -> after window
    const mondayLate = new Date(2026, 10, 23, 21, 15, 0);
    expect(isInsideDailyScheduleWindow(config, mondayLate)).toBe(false);

    // Saturday (day 6) at 10:30 AM -> outside (Saturday not selected)
    const saturday = new Date(2026, 10, 21, 10, 30, 0);
    expect(isInsideDailyScheduleWindow(config, saturday)).toBe(false);
  });

  // 6. Overnight window checking
  it('accurately evaluates overnight schedule windows crossing midnight', () => {
    const config: DailyScheduleConfig = {
      enabled: true,
      startTime: '22:00',
      endTime: '02:00',
      days: [1, 2, 3, 4, 5], // Monday through Friday nights
      notifyOnStartEnd: true,
    };

    // Monday at 23:30 (11:30 PM) -> inside
    const mondayNight = new Date(2026, 10, 23, 23, 30, 0);
    expect(isInsideDailyScheduleWindow(config, mondayNight)).toBe(true);

    // Tuesday at 01:15 AM (early morning after Monday) -> inside
    const tuesdayMorning = new Date(2026, 10, 24, 1, 15, 0);
    expect(isInsideDailyScheduleWindow(config, tuesdayMorning)).toBe(true);

    // Tuesday at 03:00 AM -> outside
    const tuesdayLateMorning = new Date(2026, 10, 24, 3, 0, 0);
    expect(isInsideDailyScheduleWindow(config, tuesdayLateMorning)).toBe(false);

    // Monday at 21:00 (9:00 PM) -> before window starts
    const mondayEvening = new Date(2026, 10, 23, 21, 0, 0);
    expect(isInsideDailyScheduleWindow(config, mondayEvening)).toBe(false);
  });

  // 7. Status computation and state labels
  it('computes correct status and labels across different schedule scenarios', () => {
    const disabledConfig: DailyScheduleConfig = {
      ...DEFAULT_DAILY_SCHEDULE,
      enabled: false,
    };
    const offStatus = computeDailyScheduleStatus(disabledConfig);
    expect(offStatus.state).toBe('off');
    expect(offStatus.label).toBe('Off');

    const activeConfig: DailyScheduleConfig = {
      enabled: true,
      startTime: '08:00',
      endTime: '21:00',
      days: [1, 2, 3, 4, 5, 6, 7],
      notifyOnStartEnd: true,
    };
    // Noon inside window
    const noon = new Date(2026, 10, 21, 12, 0, 0);
    const activeStatus = computeDailyScheduleStatus(activeConfig, noon);
    expect(activeStatus.state).toBe('active');
    expect(activeStatus.label).toBe('Active now');
    expect(activeStatus.summary).toContain('8:00 AM – 9:00 PM');

    // 7:00 AM before window today
    const early = new Date(2026, 10, 21, 7, 0, 0);
    const earlyStatus = computeDailyScheduleStatus(activeConfig, early);
    expect(earlyStatus.state).toBe('scheduled');
    expect(earlyStatus.label).toBe('Starts today 8:00 AM');

    // 10:00 PM after window today
    const late = new Date(2026, 10, 21, 22, 0, 0);
    const lateStatus = computeDailyScheduleStatus(activeConfig, late);
    expect(lateStatus.state).toBe('scheduled');
    expect(lateStatus.label).toBe('Starts tomorrow 8:00 AM');
  });

  // 8. Manual stop during window sets "Paused for today"
  it('pauses schedule for today when manual stop is called during window', () => {
    const config: DailyScheduleConfig = {
      enabled: true,
      startTime: '08:00',
      endTime: '21:00',
      days: [1, 2, 3, 4, 5, 6, 7],
      notifyOnStartEnd: true,
    };
    setDailyScheduleConfig(config);

    const noon = new Date(2026, 10, 21, 12, 0, 0);
    const activeBefore = computeDailyScheduleStatus(config, noon);
    expect(activeBefore.state).toBe('active');

    // User stops reminders during active window
    markSchedulePausedToday(noon);

    const pausedConfig = getDailyScheduleConfig();
    const pausedStatus = computeDailyScheduleStatus(pausedConfig, noon);
    expect(pausedStatus.state).toBe('paused');
    expect(pausedStatus.label).toBe('Paused for today');
    expect(pausedStatus.summary).toContain('resumes tomorrow at 8:00 AM');

    // User manually starts reminders -> clears pause
    clearSchedulePausedToday();
    const resumedConfig = getDailyScheduleConfig();
    const resumedStatus = computeDailyScheduleStatus(resumedConfig, noon);
    expect(resumedStatus.state).toBe('active');
  });

  // 9. Day chips summary
  it('produces helpful summary text for different day selections', () => {
    const weekdaysConfig: DailyScheduleConfig = {
      enabled: true,
      startTime: '08:00',
      endTime: '20:00',
      days: [1, 2, 3, 4, 5],
      notifyOnStartEnd: true,
    };
    const weekdaysStatus = computeDailyScheduleStatus(weekdaysConfig);
    expect(weekdaysStatus.summary).toContain('Mon–Fri');

    const weekendConfig: DailyScheduleConfig = {
      enabled: true,
      startTime: '09:00',
      endTime: '18:00',
      days: [6, 7],
      notifyOnStartEnd: true,
    };
    const weekendStatus = computeDailyScheduleStatus(weekendConfig);
    expect(weekendStatus.summary).toContain('weekends');
  });

  // 10. Persistence roundtrip
  it('persists and updates configuration cleanly', async () => {
    const newConfig: DailyScheduleConfig = {
      enabled: true,
      startTime: '07:30',
      endTime: '22:30',
      days: [1, 3, 5],
      notifyOnStartEnd: false,
    };

    await saveDailySchedule(newConfig);

    const loaded = getDailyScheduleConfig();
    expect(loaded.enabled).toBe(true);
    expect(loaded.startTime).toBe('07:30');
    expect(loaded.endTime).toBe('22:30');
    expect(loaded.days).toEqual([1, 3, 5]);
    expect(loaded.notifyOnStartEnd).toBe(false);
  });
});
