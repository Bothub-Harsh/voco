import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  saveWord,
  updateWord,
  deleteWord,
  getWordById,
  getAllWords,
} from '../src/db/indexedDb';
import { generateFreshQuizSession } from '../src/services/quizGenerator';
import { validateVocabularyPayload } from '../server/validator.js';
import type { VocabularyWord, WordQuizPayload } from '../src/types';

describe('Word Explanation and Refresh Feature Tests', () => {
  beforeEach(async () => {
    // Reset words for isolated test runs
    const words = await getAllWords();
    for (const w of words) {
      await deleteWord(w.id);
    }
  });

  it('validates a beginner dictionary-style explanation and example sentence payload', () => {
    const rawPayload = {
      word: 'Discrimination',
      meaning:
        'Discrimination means treating someone unfairly or differently because of their identity, such as their caste, religion, gender, skin colour, or background.',
      example: 'Discrimination in the workplace is unfair and should not be allowed.',
      options: [
        'Treating someone unfairly because of who they are',
        'Praising someone for doing a great job',
        'Traveling to another city for work',
        'Taking a test in school',
      ],
      correctIndex: 0,
    };

    const validated = validateVocabularyPayload(rawPayload);
    expect(validated.word).toBe('Discrimination');
    expect(validated.meaning).toContain('treating someone unfairly');
    expect(validated.example).toBe('Discrimination in the workplace is unfair and should not be allowed.');
    expect(validated.options).toHaveLength(4);
    expect(validated.options[validated.correctIndex]).toBe('Treating someone unfairly because of who they are');
  });

  it('updates an existing word with refreshed explanation and example without duplicating', async () => {
    // 1. Initial word saved
    const initialPayload: WordQuizPayload = {
      word: 'Benevolent',
      meaning: 'Kind, caring, and helpful to others.',
      example: 'A benevolent neighbor brought hot soup to the sick elder.',
      options: [
        'Rough and unkind',
        'Kind, caring, and helpful to others',
        'Tired and sleepy',
        'Angry and upset',
      ],
      correctIndex: 1,
    };

    const savedInitial = await saveWord(initialPayload);
    expect(savedInitial.id).toBeDefined();

    const allBeforeRefresh = await getAllWords();
    expect(allBeforeRefresh).toHaveLength(1);
    expect(allBeforeRefresh[0].meaning).toBe('Kind, caring, and helpful to others.');

    // 2. Refreshed payload with alternative wording
    const refreshedUpdate: VocabularyWord = {
      ...savedInitial,
      meaning: 'Benevolent describes a person who desires to do good and show goodwill toward others.',
      example: 'The benevolent doctor offered free checkups to families in need.',
      options: [
        'A person who desires to do good and show goodwill',
        'Someone who steals from others',
        'A person who moves very fast',
        'Someone who is fearful and shy',
      ],
      correctIndex: 0,
    };

    const updated = await updateWord(refreshedUpdate);

    // Verify word id and word spelling remain unchanged
    expect(updated.id).toBe(savedInitial.id);
    expect(updated.word).toBe('Benevolent');
    expect(updated.meaning).toBe(
      'Benevolent describes a person who desires to do good and show goodwill toward others.'
    );
    expect(updated.example).toBe('The benevolent doctor offered free checkups to families in need.');

    // Verify no duplicate word was created in IndexedDB
    const allAfterRefresh = await getAllWords();
    expect(allAfterRefresh).toHaveLength(1);
    expect(allAfterRefresh[0].id).toBe(savedInitial.id);
    expect(allAfterRefresh[0].meaning).toBe(
      'Benevolent describes a person who desires to do good and show goodwill toward others.'
    );
  });

  it('ensures quiz sessions use the updated refreshed meaning as correct answer', async () => {
    const word: VocabularyWord = {
      id: 'test-discrim-1',
      word: 'Discrimination',
      wordLower: 'discrimination',
      meaning:
        'Discrimination means treating someone unfairly or differently because of their identity.',
      example: 'Discrimination in the workplace is unfair and should not be allowed.',
      options: [
        'Treating someone unfairly because of their identity',
        'Helping children with their homework',
        'Cleaning up trash from the street',
        'Singing songs with classmates',
      ],
      correctIndex: 0,
      dateAdded: Date.now(),
    };

    const session = generateFreshQuizSession(word, [word]);
    expect(session.word).toBe('Discrimination');
    expect(session.meaning).toBe(
      'Discrimination means treating someone unfairly or differently because of their identity.'
    );
    expect(session.options).toHaveLength(4);
    // Correct index must match the refreshed meaning
    expect(session.options[session.correctIndex]).toBe(
      'Discrimination means treating someone unfairly or differently because of their identity.'
    );
  });

  it('preserves existing word in IndexedDB if update validation fails', async () => {
    const initialPayload: WordQuizPayload = {
      word: 'Diligent',
      meaning: 'Hardworking and putting care into tasks.',
      example: 'The diligent student finished her homework before dinner.',
      options: ['Hardworking and putting care into tasks', 'Lazy', 'Quick', 'Sleepy'],
      correctIndex: 0,
    };

    const saved = await saveWord(initialPayload);

    // Attempt invalid update (empty meaning)
    const invalidUpdate = {
      ...saved,
      meaning: '  ',
    };

    await expect(updateWord(invalidUpdate as VocabularyWord)).rejects.toThrow();

    // Verify original word remains uncorrupted
    const stored = await getWordById(saved.id);
    expect(stored).toBeDefined();
    expect(stored?.meaning).toBe('Hardworking and putting care into tasks.');
  });
});
