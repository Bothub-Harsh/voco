import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveManualWord,
  getAllWords,
  updateWord,
  deleteWord,
  exportBackupJson,
  importBackupJson,
} from '../src/db/indexedDb';
import { generateFreshQuizSession } from '../src/services/quizGenerator';
import {
  pickNextReminderWord,
  getSavedReminderInterval,
  setSavedReminderInterval,
} from '../src/services/notifications';

describe('Voco Offline Core Features Regression Suite', () => {
  beforeEach(async () => {
    // Clear IndexedDB before each test
    const words = await getAllWords();
    for (const w of words) {
      await deleteWord(w.id);
    }
    // Block fetch to guarantee 0 network calls can be made
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network should not be called in offline tests'));
  });

  it('1. Adds and persists manual vocabulary completely offline', async () => {
    const saved = await saveManualWord({
      word: 'Resilient',
      meaning: 'Able to recover quickly from difficult conditions.',
      example: 'The team was resilient in the face of setbacks.',
      hindiMeaning: 'कठिन परिस्थितियों से जल्दी उबरने में सक्षम।',
    });

    expect(saved.id).toBeDefined();
    expect(saved.word).toBe('Resilient');
    expect(saved.isCustomMeaning).toBe(true);
    expect(saved.options).toHaveLength(4);
    expect(saved.options[saved.correctIndex]).toBe('Able to recover quickly from difficult conditions.');

    const all = await getAllWords();
    expect(all).toHaveLength(1);
    expect(all[0].word).toBe('Resilient');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('2. Edits and deletes vocabulary locally without internet', async () => {
    const saved = await saveManualWord({
      word: 'Luminous',
      meaning: 'Bright and shining.',
    });

    // Edit
    const updated = await updateWord({
      ...saved,
      meaning: 'Emitting or reflecting steady, suffocating or bright light.',
    });
    expect(updated.meaning).toBe('Emitting or reflecting steady, suffocating or bright light.');

    // Delete
    await deleteWord(saved.id);
    const allAfterDelete = await getAllWords();
    expect(allAfterDelete).toHaveLength(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('3. Generates fresh offline quiz sessions with distinct local distractors', async () => {
    const w1 = await saveManualWord({ word: 'Acuity', meaning: 'Sharpness or keenness of thought.' });
    const w2 = await saveManualWord({ word: 'Lucid', meaning: 'Clear and easy to understand.' });
    const w3 = await saveManualWord({ word: 'Candid', meaning: 'Truthful and straightforward.' });
    const w4 = await saveManualWord({ word: 'Poised', meaning: 'Composed, dignified, and self-assured.' });

    const all = await getAllWords();
    expect(all).toHaveLength(4);

    const quiz = generateFreshQuizSession(w1, all);
    expect(quiz.word).toBe('Acuity');
    expect(quiz.options).toHaveLength(4);
    expect(quiz.options[quiz.correctIndex]).toBe('Sharpness or keenness of thought.');

    // Ensure all 4 options are distinct strings
    const unique = new Set(quiz.options.map((o) => o.toLowerCase()));
    expect(unique.size).toBe(4);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('4. Picks next reminder word locally in round-robin fashion', async () => {
    const w1 = await saveManualWord({ word: 'Pragmatic', meaning: 'Dealing with things sensibly.' });
    const w2 = await saveManualWord({ word: 'Tenacious', meaning: 'Tending to keep a firm hold.' });

    const all = [w1, w2];
    const picked1 = pickNextReminderWord(all);
    expect(picked1).toBeDefined();
    expect([w1.id, w2.id]).toContain(picked1?.id);

    const picked2 = pickNextReminderWord(all);
    expect(picked2).toBeDefined();

    // Verify reminder interval storage
    setSavedReminderInterval(15);
    expect(getSavedReminderInterval()).toBe(15);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('5. Exports and imports complete backup JSON locally', async () => {
    await saveManualWord({ word: 'Zeal', meaning: 'Great energy or enthusiasm.' });
    const exportStr = await exportBackupJson();

    expect(exportStr).toContain('Zeal');
    const parsed = JSON.parse(exportStr);
    expect(Array.isArray(parsed.words)).toBe(true);
    expect(parsed.words).toHaveLength(1);

    // Delete all words
    const all = await getAllWords();
    for (const w of all) {
      await deleteWord(w.id);
    }
    expect(await getAllWords()).toHaveLength(0);

    // Import from JSON
    const importResult = await importBackupJson(exportStr);
    expect(importResult.importedCount).toBe(1);

    const restored = await getAllWords();
    expect(restored).toHaveLength(1);
    expect(restored[0].word).toBe('Zeal');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
