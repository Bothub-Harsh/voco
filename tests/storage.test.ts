import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveWord,
  saveManualWord,
  getAllWords,
  getWordByName,
  getWordById,
  updateWord,
  deleteWord,
  exportBackupJson,
  importBackupJson,
  migrateFromLocalStorageIfPresent,
} from '../src/db/indexedDb';
import type { WordQuizPayload } from '../src/types';

describe('IndexedDB Local Storage & Backup Engine', () => {
  const sampleWord: WordQuizPayload = {
    word: 'Diligent',
    meaning: 'Hardworking and showing care in one\'s work.',
    example: 'He was a diligent worker who completed tasks on time.',
    options: ['Hardworking', 'Lazy', 'Angry', 'Confused'],
    correctIndex: 0,
  };

  beforeEach(async () => {
    // Clear all words before each test
    const words = await getAllWords();
    for (const w of words) {
      await deleteWord(w.id);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('1. Saves a complete word record into IndexedDB with all required fields', async () => {
    const saved = await saveWord(sampleWord);

    expect(saved.id).toBeDefined();
    expect(saved.word).toBe('Diligent');
    expect(saved.wordLower).toBe('diligent');
    expect(saved.meaning).toBe('Hardworking and showing care in one\'s work.');
    expect(saved.example).toBe('He was a diligent worker who completed tasks on time.');
    expect(saved.options).toHaveLength(4);
    expect(saved.correctIndex).toBe(0);
    expect(saved.dateAdded).toBeGreaterThan(0);

    // Verify it is directly retrievable from IndexedDB
    const retrieved = await getWordById(saved.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.word).toBe('Diligent');
  });

  it('2. Loads all saved words on refresh (persists in IndexedDB)', async () => {
    await saveWord(sampleWord);
    await saveWord({
      word: 'Serene',
      meaning: 'Calm, peaceful, and untroubled.',
      example: 'The lake was serene in the morning.',
      options: ['Noisy', 'Calm and peaceful', 'Violent', 'Bright'],
      correctIndex: 1,
    });

    const all = await getAllWords();
    expect(all).toHaveLength(2);
    expect(all.map((w) => w.word)).toContain('Diligent');
    expect(all.map((w) => w.word)).toContain('Serene');
  });

  it('3. Prevents accidental duplicate words case-insensitively', async () => {
    await saveWord(sampleWord);

    // Try saving lowercase duplicate
    await expect(
      saveWord({
        ...sampleWord,
        word: 'diligent',
      })
    ).rejects.toThrow('"diligent" is already in your vocabulary list.');

    // Try saving uppercase duplicate
    await expect(
      saveWord({
        ...sampleWord,
        word: 'DILIGENT',
      })
    ).rejects.toThrow('"DILIGENT" is already in your vocabulary list.');
  });

  it('4. Updates an existing word in IndexedDB correctly', async () => {
    const saved = await saveWord(sampleWord);

    const updated = await updateWord({
      ...saved,
      meaning: 'Showing steady, earnest, and energetic effort.',
      example: 'She was a diligent student in class.',
    });

    expect(updated.meaning).toBe('Showing steady, earnest, and energetic effort.');

    // Verify record in IndexedDB reflects update
    const reloaded = await getWordById(saved.id);
    expect(reloaded?.meaning).toBe('Showing steady, earnest, and energetic effort.');
    expect(reloaded?.example).toBe('She was a diligent student in class.');
  });

  it('5. Deletes a word from IndexedDB', async () => {
    const saved = await saveWord(sampleWord);
    expect(await getAllWords()).toHaveLength(1);

    await deleteWord(saved.id);

    const reloaded = await getAllWords();
    expect(reloaded).toHaveLength(0);
    expect(await getWordById(saved.id)).toBeUndefined();
  });

  it('6. Handles failed saves and rejects invalid data before writing', async () => {
    // Missing word
    await expect(
      saveWord({ ...sampleWord, word: '   ' })
    ).rejects.toThrow('Word spelling cannot be empty.');

    // Missing meaning
    await expect(
      saveWord({ ...sampleWord, meaning: '' })
    ).rejects.toThrow('Word meaning cannot be empty.');

    // Invalid options count
    await expect(
      saveWord({
        ...sampleWord,
        options: ['1', '2'] as unknown as [string, string, string, string],
      })
    ).rejects.toThrow('Word quiz must have exactly 4 multiple-choice options.');

    // Invalid correct index
    await expect(
      saveWord({ ...sampleWord, correctIndex: 5 })
    ).rejects.toThrow('Correct answer index must be an integer between 0 and 3.');

    // Ensure database remained empty
    expect(await getAllWords()).toHaveLength(0);
  });

  it('7. Exports saved words to a valid JSON backup', async () => {
    await saveWord(sampleWord);

    const jsonString = await exportBackupJson();
    const parsed = JSON.parse(jsonString);

    expect(parsed.appName).toBe('My Vocabulary');
    expect(parsed.version).toBe(1);
    expect(parsed.words).toHaveLength(1);
    expect(parsed.words[0].word).toBe('Diligent');
  });

  it('8. Imports backup with validation, skipping duplicates and keeping existing data', async () => {
    // Existing word in IndexedDB
    await saveWord(sampleWord);

    const backupToImport = JSON.stringify({
      appName: 'My Vocabulary',
      version: 1,
      words: [
        // Duplicate word (should be skipped)
        sampleWord,
        // New valid word (should be imported)
        {
          word: 'Eloquent',
          meaning: 'Fluent or persuasive in speaking or writing.',
          example: 'An eloquent speaker captivated the audience.',
          options: ['Fluent and persuasive', 'Quiet', 'Angry', 'Confused'],
          correctIndex: 0,
        },
        // Invalid word item (should be skipped and recorded in errors)
        {
          word: '',
          meaning: 'Invalid item',
        },
      ],
    });

    const result = await importBackupJson(backupToImport);
    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(1); // Diligent skipped
    expect(result.errors.length).toBe(1); // Empty word error

    // Verify database now contains both words
    const allWords = await getAllWords();
    expect(allWords).toHaveLength(2);
    expect(allWords.map((w) => w.word)).toContain('Diligent');
    expect(allWords.map((w) => w.word)).toContain('Eloquent');
  });

  it('9. Migrates legacy words from localStorage into IndexedDB without deleting original data', async () => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    };

    const legacyWords = [
      {
        word: 'Ponder',
        meaning: 'Think about something carefully.',
        example: 'She paused to ponder the question.',
        options: ['Think carefully', 'Run quickly', 'Shout', 'Sleep'],
        correctIndex: 0,
      },
    ];

    localStorage.setItem('my_vocabulary_words', JSON.stringify(legacyWords));

    const migrationResult = await migrateFromLocalStorageIfPresent();
    expect(migrationResult.migratedCount).toBe(1);

    // Verify word is now in IndexedDB
    const wordInDB = await getWordByName('ponder');
    expect(wordInDB).toBeDefined();
    expect(wordInDB?.word).toBe('Ponder');

    // Verify localStorage data was NOT deleted or cleared
    expect(localStorage.getItem('my_vocabulary_words')).toBeTruthy();
  });

  it('10. Saves a manual word with user-written meaning and example correctly into IndexedDB', async () => {
    const manualSaved = await saveManualWord({
      word: 'Resilient',
      meaning: 'Able to recover quickly from difficult conditions.',
      example: 'She remained resilient in the face of hardship.',
    });

    expect(manualSaved.id).toBeDefined();
    expect(manualSaved.word).toBe('Resilient');
    expect(manualSaved.wordLower).toBe('resilient');
    expect(manualSaved.meaning).toBe('Able to recover quickly from difficult conditions.');
    expect(manualSaved.example).toBe('She remained resilient in the face of hardship.');
    expect(manualSaved.isCustomMeaning).toBe(true);
    expect(manualSaved.options).toHaveLength(4);
    expect(manualSaved.options[manualSaved.correctIndex]).toBe('Able to recover quickly from difficult conditions.');

    // Verify it persists in IndexedDB
    const fromDb = await getWordById(manualSaved.id);
    expect(fromDb?.word).toBe('Resilient');
    expect(fromDb?.meaning).toBe('Able to recover quickly from difficult conditions.');
  });

  it('11. Prevents saving manual words with empty word or meaning, and prevents duplicates', async () => {
    // Empty word
    await expect(
      saveManualWord({ word: '', meaning: 'Some meaning' })
    ).rejects.toThrow('Word spelling cannot be empty.');

    // Empty meaning
    await expect(
      saveManualWord({ word: 'Word', meaning: '   ' })
    ).rejects.toThrow('Word meaning cannot be empty.');

    // Save initial
    await saveManualWord({ word: 'Audacious', meaning: 'Willing to take bold risks.' });

    // Duplicate check
    await expect(
      saveManualWord({ word: 'audacious', meaning: 'Different meaning' })
    ).rejects.toThrow('"audacious" is already in your vocabulary list.');
  });

  it('12. Allows optional example sentence for manual words', async () => {
    const saved = await saveManualWord({
      word: 'Tenacious',
      meaning: 'Holding fast or keeping a firm grip.',
    });

    expect(saved.example).toBeDefined();
    expect(saved.example.length).toBeGreaterThan(0);
    expect(saved.meaning).toBe('Holding fast or keeping a firm grip.');
  });
});
