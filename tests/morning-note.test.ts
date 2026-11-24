import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveNotePlaceholders,
  getDailyScheduleConfig,
  saveDailySchedule,
  DEFAULT_DAILY_SCHEDULE,
} from '../src/services/notifications';

describe('Morning Note Service & Placeholders Engine', () => {
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

  describe('resolveNotePlaceholders', () => {
    it('replaces {words} with saved word count', () => {
      const text = 'You have {words} words saved in your library!';
      const res = resolveNotePlaceholders(text, 42, '9:00 PM');
      expect(res).toBe('You have 42 words saved in your library!');
    });

    it('replaces {end} with formatted stop time', () => {
      const text = 'Reminders run until {end}. Keep it up!';
      const res = resolveNotePlaceholders(text, 10, '10:30 PM');
      expect(res).toBe('Reminders run until 10:30 PM. Keep it up!');
    });

    it('replaces both {words} and {end} case-insensitively', () => {
      const text = 'Practice {WORDS} words before {END}!';
      const res = resolveNotePlaceholders(text, 150, '11:00 PM');
      expect(res).toBe('Practice 150 words before 11:00 PM!');
    });

    it('leaves unknown placeholders untouched as plain text', () => {
      const text = 'Hello {name}, you have {words} words to practice by {end} (task {id})';
      const res = resolveNotePlaceholders(text, 25, '8:00 PM');
      expect(res).toBe('Hello {name}, you have 25 words to practice by 8:00 PM (task {id})');
    });

    it('handles empty text, emoji, and Hindi unicode text gracefully', () => {
      expect(resolveNotePlaceholders('', 10, '9:00 PM')).toBe('');
      const unicodeText = 'नमस्ते! आज {words} शब्द सीखें 🌟 reminders end at {end}';
      const res = resolveNotePlaceholders(unicodeText, 5, '9:00 PM');
      expect(res).toBe('नमस्ते! आज 5 शब्द सीखें 🌟 reminders end at 9:00 PM');
    });

    it('handles line breaks and multiline notes properly', () => {
      const multi = 'Line 1: Good morning!\nLine 2: Words: {words}\nLine 3: Stop at {end}';
      const res = resolveNotePlaceholders(multi, 12, '10:00 PM');
      expect(res).toBe('Line 1: Good morning!\nLine 2: Words: 12\nLine 3: Stop at 10:00 PM');
    });
  });

  describe('Daily Schedule Configuration with Morning Note', () => {
    it('returns default morningNoteTitle and empty text when unconfigured', () => {
      const cfg = getDailyScheduleConfig();
      expect(cfg.morningNoteTitle).toBe('Good morning');
      expect(cfg.morningNoteText).toBe('');
    });

    it('saves and reads custom morningNoteTitle and morningNoteText', async () => {
      const customConfig = {
        ...DEFAULT_DAILY_SCHEDULE,
        enabled: true,
        morningNoteTitle: 'Rise & Shine 🚀',
        morningNoteText: 'Today is day 1! Review {words} words before {end}.\nStay focused!',
      };

      await saveDailySchedule(customConfig);
      const readBack = getDailyScheduleConfig();
      expect(readBack.morningNoteTitle).toBe('Rise & Shine 🚀');
      expect(readBack.morningNoteText).toBe('Today is day 1! Review {words} words before {end}.\nStay focused!');
    });

    it('supports Hindi Unicode characters in morningNoteTitle and morningNoteText', async () => {
      const hindiConfig = {
        ...DEFAULT_DAILY_SCHEDULE,
        enabled: true,
        morningNoteTitle: 'शुभ प्रभात ☀️',
        morningNoteText: 'आज का दिन शुभ हो। अपनी शब्दावली का अभ्यास करें।',
      };

      await saveDailySchedule(hindiConfig);
      const readBack = getDailyScheduleConfig();
      expect(readBack.morningNoteTitle).toBe('शुभ प्रभात ☀️');
      expect(readBack.morningNoteText).toBe('आज का दिन शुभ हो। अपनी शब्दावली का अभ्यास करें।');
    });
  });
});
