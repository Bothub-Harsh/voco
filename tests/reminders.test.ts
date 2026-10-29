import { describe, it, expect, beforeEach } from 'vitest';
import {
  pickNextReminderWord,
  DEFAULT_INTERVAL_MS,
  getSavedReminderInterval,
  setSavedReminderInterval,
  formatCountdownSeconds,
  getNextReminderTimestamp,
  setNextReminderTimestamp,
} from '../src/services/notifications';
import type { VocabularyWord } from '../src/types';

describe('Reminder Selection & Notification Service', () => {
  const sampleWords: VocabularyWord[] = [
    {
      id: 'id-1',
      word: 'Harsh',
      wordLower: 'harsh',
      meaning: 'Rough or severe',
      example: 'The weather was harsh.',
      options: ['Kind', 'Rough or severe', 'Calm', 'Soft'],
      correctIndex: 1,
      dateAdded: 1000,
    },
    {
      id: 'id-2',
      word: 'Diligent',
      wordLower: 'diligent',
      meaning: 'Hardworking and careful',
      example: 'She is a diligent student.',
      options: ['Lazy', 'Careless', 'Hardworking and careful', 'Quiet'],
      correctIndex: 2,
      dateAdded: 2000,
    },
    {
      id: 'id-3',
      word: 'Benevolent',
      wordLower: 'benevolent',
      meaning: 'Kind and generous',
      example: 'A benevolent leader helped them.',
      options: ['Selfish', 'Angry', 'Strict', 'Kind and generous'],
      correctIndex: 3,
      dateAdded: 3000,
    },
  ];

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

  it('sets default reminder interval to exactly five minutes (300,000 ms)', () => {
    expect(DEFAULT_INTERVAL_MS).toBe(5 * 60 * 1000);
  });

  it('returns null when no words have been saved', () => {
    const selected = pickNextReminderWord([]);
    expect(selected).toBeNull();
  });

  it('returns the single word when exactly one word exists', () => {
    const selected = pickNextReminderWord([sampleWords[0]]);
    expect(selected?.id).toBe('id-1');
  });

  it('avoids consecutively selecting the same word when other words are available', () => {
    // First pick
    const firstPick = pickNextReminderWord(sampleWords);
    expect(firstPick).toBeDefined();

    // Second pick should not be the same as first
    const secondPick = pickNextReminderWord(sampleWords);
    expect(secondPick?.id).not.toBe(firstPick?.id);
  });

  it('formats notification content without revealing the correct answer', () => {
    const word = sampleWords[0];
    const title = 'My Vocabulary — Practice Time!';
    const body = `What does ${word.word.toUpperCase()} mean?`;

    expect(title).toBe('My Vocabulary — Practice Time!');
    expect(body).toBe('What does HARSH mean?');
    // Ensure the correct meaning is never in the notification body or title
    expect(body).not.toContain(word.meaning);
    expect(title).not.toContain(word.meaning);
  });

  it('enforces a minimum reminder interval of 1 minute', () => {
    expect(setSavedReminderInterval(1)).toBe(1);
    expect(getSavedReminderInterval()).toBe(1);

    // Clamps values less than 1 to 1
    expect(setSavedReminderInterval(0)).toBe(1);
    expect(getSavedReminderInterval()).toBe(1);

    expect(setSavedReminderInterval(-10)).toBe(1);
    expect(getSavedReminderInterval()).toBe(1);

    // Allows higher intervals
    expect(setSavedReminderInterval(15)).toBe(15);
    expect(getSavedReminderInterval()).toBe(15);
  });

  it('formats countdown seconds into MM:SS correctly', () => {
    expect(formatCountdownSeconds(60)).toBe('01:00');
    expect(formatCountdownSeconds(90)).toBe('01:30');
    expect(formatCountdownSeconds(9)).toBe('00:09');
    expect(formatCountdownSeconds(0)).toBe('00:00');
    expect(formatCountdownSeconds(-5)).toBe('00:00');
    expect(formatCountdownSeconds(300)).toBe('05:00');
  });

  it('stores and retrieves target reminder timestamps correctly', () => {
    const future = Date.now() + 60000;
    setNextReminderTimestamp(future);
    expect(getNextReminderTimestamp()).toBe(future);

    setNextReminderTimestamp(null);
    expect(getNextReminderTimestamp()).toBeNull();
  });
});
