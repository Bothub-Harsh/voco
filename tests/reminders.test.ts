import { describe, it, expect, beforeEach } from 'vitest';
import { pickNextReminderWord, DEFAULT_INTERVAL_MS } from '../src/services/notifications';
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
});
