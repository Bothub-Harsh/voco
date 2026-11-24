import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// Ensure localStorage mock is available in node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    length: 0,
  } as Storage;
}

import {
  saveWord,
  getAllWords,
  deleteWord,
  getAllSections,
  createSection,
  renameSection,
  deleteSection,
  mergeSections,
  undoMergeSections,
  undoDeleteSection,
  getSectionWordCounts,
  getWordsForSection,
  addWordsToSection,
  removeWordsFromSection,
  setWordSections,
  getWordSectionMapping,
  getReminderSelectedSectionIds,
  setReminderSelectedSectionIds,
  getReminderWordPool,
  exportBackupJson,
  importBackupJson,
  closeDB,
  ALL_WORDS_SECTION_ID,
} from '../src/db/indexedDb';
import {
  isStrictModeEnabled,
  setStrictModeEnabled,
  STRICT_MODE_STORAGE_KEY,
} from '../src/services/notifications';
import type { WordQuizPayload } from '../src/types';

describe('Word Sections & Strict Reminder Mode Tests', () => {
  const cleanupDB = async () => {
    await closeDB();
    const req = indexedDB.deleteDatabase('MyVocabularyDB');
    await new Promise((resolve) => {
      req.onsuccess = resolve;
      req.onerror = resolve;
    });
    localStorage.clear();
  };

  beforeEach(async () => {
    await cleanupDB();
  });

  afterEach(async () => {
    await cleanupDB();
  });

  const makeWordPayload = (word: string): WordQuizPayload => ({
    word,
    meaning: `Meaning of ${word}`,
    example: `Example with ${word}`,
    hindiMeaning: `${word} का अर्थ`,
    hindiExample: `${word} का उदाहरण`,
    options: [`Meaning of ${word}`, 'Wrong 1', 'Wrong 2', 'Wrong 3'],
    correctIndex: 0,
  });

  it('1. Default All Words section always exists and cannot be deleted or renamed', async () => {
    const sections = await getAllSections();
    expect(sections.length).toBeGreaterThanOrEqual(1);
    expect(sections[0].id).toBe(ALL_WORDS_SECTION_ID);
    expect(sections[0].name).toBe('All Words');

    // Attempt to delete All Words
    await expect(deleteSection(ALL_WORDS_SECTION_ID)).rejects.toThrow('cannot be deleted');

    // Attempt to rename All Words
    await expect(renameSection(ALL_WORDS_SECTION_ID, 'New Name')).rejects.toThrow('cannot be renamed');
  });

  it('2. Creates user sections with trimming, validation and case-insensitive uniqueness', async () => {
    const s1 = await createSection('  Exam Words  ');
    expect(s1.name).toBe('Exam Words');

    // Duplicate case-insensitive
    await expect(createSection('exam words')).rejects.toThrow('already exists');

    // Empty or blank
    await expect(createSection('   ')).rejects.toThrow('cannot be empty');

    // Name too long (>30 chars)
    const longName = 'A'.repeat(31);
    await expect(createSection(longName)).rejects.toThrow('30 characters');

    const all = await getAllSections();
    expect(all).toHaveLength(2); // All Words + Exam Words
  });

  it('3. Renames section with validation', async () => {
    const s1 = await createSection('Office');
    await createSection('Study');

    // Valid rename
    const renamed = await renameSection(s1.id, 'Workplace');
    expect(renamed.name).toBe('Workplace');

    // Duplicate check on rename
    await expect(renameSection(s1.id, 'study')).rejects.toThrow('already exists');
  });

  it('4. Deleting a section keeps all saved words intact', async () => {
    const w1 = await saveWord(makeWordPayload('Tenacious'));
    const w2 = await saveWord(makeWordPayload('Resilient'));

    const s1 = await createSection('GRE');
    await addWordsToSection([w1.id, w2.id], s1.id);

    // Verify words are in GRE
    const greWords = await getWordsForSection(s1.id);
    expect(greWords).toHaveLength(2);

    // Delete the GRE section
    await deleteSection(s1.id);

    // Words must still exist in IndexedDB!
    const allWords = await getAllWords();
    expect(allWords).toHaveLength(2);

    // Section memberships for GRE should be cleaned up
    const map = await getWordSectionMapping();
    expect(map[w1.id] || []).not.toContain(s1.id);
    expect(map[w2.id] || []).not.toContain(s1.id);
  });

  it('5. Deleting a word cleans up its section memberships', async () => {
    const w1 = await saveWord(makeWordPayload('Ephemeral'));

    const s1 = await createSection('Poetry');
    await addWordsToSection([w1.id], s1.id);

    let map = await getWordSectionMapping();
    expect(map[w1.id]).toContain(s1.id);

    await deleteWord(w1.id);

    map = await getWordSectionMapping();
    expect(map[w1.id]).toBeUndefined();

    const counts = await getSectionWordCounts();
    expect(counts[s1.id] || 0).toBe(0);
  });

  it('6. Section memberships and word counts work across multiple sections', async () => {
    const w1 = await saveWord(makeWordPayload('Lucid'));
    const w2 = await saveWord(makeWordPayload('Meticulous'));
    const w3 = await saveWord(makeWordPayload('Pragmatic'));

    const secA = await createSection('Section A');
    const secB = await createSection('Section B');

    // w1 in A, w2 in A & B, w3 in B
    await setWordSections(w1.id, [secA.id]);
    await setWordSections(w2.id, [secA.id, secB.id]);
    await setWordSections(w3.id, [secB.id]);

    const counts = await getSectionWordCounts();
    expect(counts[secA.id]).toBe(2);
    expect(counts[secB.id]).toBe(2);

    const map = await getWordSectionMapping();
    expect(map[w2.id].slice().sort()).toEqual([ALL_WORDS_SECTION_ID, secA.id, secB.id].sort());

    // Remove w2 from Section A
    await removeWordsFromSection([w2.id], secA.id);
    const updatedCounts = await getSectionWordCounts();
    expect(updatedCounts[secA.id]).toBe(1);
    expect(updatedCounts[secB.id]).toBe(2);
  });

  it('7. Reminder word pool computes union without duplicates, handles All Words and empty pool', async () => {
    const w1 = await saveWord(makeWordPayload('Alpha'));
    const w2 = await saveWord(makeWordPayload('Beta'));
    await saveWord(makeWordPayload('Gamma'));

    const sec1 = await createSection('Group 1');
    const sec2 = await createSection('Group 2');
    const secEmpty = await createSection('Group Empty');

    // w1 in sec1; w2 in sec1 and sec2; w3 not in any user section
    await addWordsToSection([w1.id, w2.id], sec1.id);
    await addWordsToSection([w2.id], sec2.id);

    // Default: All Words selected -> returns all 3 words
    await setReminderSelectedSectionIds([ALL_WORDS_SECTION_ID]);
    let pool = await getReminderWordPool();
    expect(pool).toHaveLength(3);

    // Select sec1 and sec2 -> union of {w1, w2} and {w2} = 2 words (w1, w2 without duplicates)
    await setReminderSelectedSectionIds([sec1.id, sec2.id]);
    pool = await getReminderWordPool();
    expect(pool).toHaveLength(2);
    const poolWords = pool.map((w) => w.word).sort();
    expect(poolWords).toEqual(['Alpha', 'Beta']);

    // Select empty section -> pool is 0 words
    await setReminderSelectedSectionIds([secEmpty.id]);
    pool = await getReminderWordPool();
    expect(pool).toHaveLength(0);

    // If section deleted, it is removed from reminder selection
    await deleteSection(secEmpty.id);
    const activeReminderSecs = await getReminderSelectedSectionIds();
    expect(activeReminderSecs).toEqual([ALL_WORDS_SECTION_ID]);
  });

  it('8. Strict Reminder Mode defaults to OFF and persists toggle state', async () => {
    expect(isStrictModeEnabled()).toBe(false);

    await setStrictModeEnabled(true);
    expect(isStrictModeEnabled()).toBe(true);
    expect(localStorage.getItem(STRICT_MODE_STORAGE_KEY)).toBe('true');

    await setStrictModeEnabled(false);
    expect(isStrictModeEnabled()).toBe(false);
    expect(localStorage.getItem(STRICT_MODE_STORAGE_KEY)).toBe('false');
  });

  it('9. Backup export and import supports v2 format with sections and memberships', async () => {
    const w1 = await saveWord(makeWordPayload('Candid'));
    await saveWord(makeWordPayload('Sincere'));

    const sec = await createSection('Favorites');
    await addWordsToSection([w1.id], sec.id);
    await setReminderSelectedSectionIds([sec.id]);

    const backupJson = await exportBackupJson();
    const backupObj = JSON.parse(backupJson);

    expect(backupObj.version).toBe(2);
    expect(backupObj.sections).toBeDefined();
    expect(backupObj.memberships).toBeDefined();
    expect(backupObj.reminderSelectedSectionIds).toEqual([sec.id]);

    // Clear everything and test import
    await cleanupDB();

    const result = await importBackupJson(backupJson);
    expect(result.importedCount).toBe(2);
    expect(result.sectionsImported).toBe(1);

    const loadedWords = await getAllWords();
    expect(loadedWords).toHaveLength(2);

    const loadedSections = await getAllSections();
    const loadedFavorites = loadedSections.find((s) => s.name === 'Favorites');
    expect(loadedFavorites).toBeDefined();

    const favWords = await getWordsForSection(loadedFavorites!.id);
    expect(favWords).toHaveLength(1);
    expect(favWords[0].word).toBe('Candid');
  });

  it('10. Importing legacy v1 backup gracefully preserves all words under All Words', async () => {
    const legacyBackup = JSON.stringify({
      appName: 'My Vocabulary',
      version: 1,
      exportedAt: new Date().toISOString(),
      words: [
        makeWordPayload('Nostalgia'),
        makeWordPayload('Serendipity'),
      ],
    });

    const result = await importBackupJson(legacyBackup);
    expect(result.importedCount).toBe(2);
    expect(result.sectionsImported).toBe(0);

    const loaded = await getAllWords();
    expect(loaded).toHaveLength(2);

    // All Words pool includes all imported words
    const pool = await getReminderWordPool();
    expect(pool).toHaveLength(2);
  });

  it('11. mergeSections: combines words without duplicates and keeps source when deleteSource is false', async () => {
    const w1 = await saveWord(makeWordPayload('Apple'));
    const w2 = await saveWord(makeWordPayload('Banana'));
    const w3 = await saveWord(makeWordPayload('Cherry'));

    const sourceSec = await createSection('Source A');
    const targetSec = await createSection('Target B');

    // Source A has Apple, Banana
    await addWordsToSection([w1.id, w2.id], sourceSec.id);
    // Target B has Banana, Cherry (Banana is in both)
    await addWordsToSection([w2.id, w3.id], targetSec.id);

    const mergeResult = await mergeSections(sourceSec.id, targetSec.id, false);
    expect(mergeResult.wordsMovedCount).toBe(1); // Only Apple was new to Target B
    expect(mergeResult.addedWordIds).toEqual([w1.id]);
    expect(mergeResult.deletedSource).toBe(false);

    // Verify Target B now has Apple, Banana, Cherry
    const targetWords = await getWordsForSection(targetSec.id);
    expect(targetWords).toHaveLength(3);
    const targetWordNames = targetWords.map((w) => w.word).sort();
    expect(targetWordNames).toEqual(['Apple', 'Banana', 'Cherry']);

    // Source A still exists and has Apple, Banana
    const sourceWords = await getWordsForSection(sourceSec.id);
    expect(sourceWords).toHaveLength(2);

    // All Words still intact
    const allWords = await getAllWords();
    expect(allWords).toHaveLength(3);
  });

  it('12. mergeSections: deletes source section and memberships when deleteSource is true', async () => {
    const w1 = await saveWord(makeWordPayload('Dog'));
    const w2 = await saveWord(makeWordPayload('Cat'));

    const sourceSec = await createSection('Source Pets');
    const targetSec = await createSection('All Animals');

    await addWordsToSection([w1.id, w2.id], sourceSec.id);
    await setReminderSelectedSectionIds([sourceSec.id]);

    const mergeResult = await mergeSections(sourceSec.id, targetSec.id, true);
    expect(mergeResult.deletedSource).toBe(true);
    expect(mergeResult.wordsMovedCount).toBe(2);

    // Source section should no longer exist
    const allSections = await getAllSections();
    expect(allSections.some((s) => s.id === sourceSec.id)).toBe(false);

    // Target section should have both words
    const targetWords = await getWordsForSection(targetSec.id);
    expect(targetWords).toHaveLength(2);

    // Reminder selection was updated to follow the target section
    const reminderSecs = await getReminderSelectedSectionIds();
    expect(reminderSecs).toEqual([targetSec.id]);

    // All Words still intact
    const allWords = await getAllWords();
    expect(allWords).toHaveLength(2);
  });

  it('13. undoMergeSections: atomically reverts merge, restores deleted source, memberships and reminder selection', async () => {
    const w1 = await saveWord(makeWordPayload('Sun'));
    const w2 = await saveWord(makeWordPayload('Moon'));

    const sourceSec = await createSection('Celestial');
    const targetSec = await createSection('Nature');

    await addWordsToSection([w1.id], sourceSec.id);
    await addWordsToSection([w2.id], targetSec.id);
    await setReminderSelectedSectionIds([sourceSec.id]);

    const mergeResult = await mergeSections(sourceSec.id, targetSec.id, true);

    // Verify merged state
    let targetWords = await getWordsForSection(targetSec.id);
    expect(targetWords).toHaveLength(2);

    // Now Undo the merge!
    await undoMergeSections(mergeResult);

    // 1. Newly added word (Sun) removed from Target
    targetWords = await getWordsForSection(targetSec.id);
    expect(targetWords).toHaveLength(1);
    expect(targetWords[0].word).toBe('Moon');

    // 2. Source section restored with Sun
    const allSections = await getAllSections();
    expect(allSections.some((s) => s.id === sourceSec.id)).toBe(true);
    const sourceWords = await getWordsForSection(sourceSec.id);
    expect(sourceWords).toHaveLength(1);
    expect(sourceWords[0].word).toBe('Sun');

    // 3. Reminder selection restored
    const reminderSecs = await getReminderSelectedSectionIds();
    expect(reminderSecs).toEqual([sourceSec.id]);
  });

  it('14. deleteSection & undoDeleteSection: restores deleted section and all memberships', async () => {
    const w1 = await saveWord(makeWordPayload('Echo'));
    const w2 = await saveWord(makeWordPayload('Foxtrot'));

    const sec = await createSection('Aviation');
    await addWordsToSection([w1.id, w2.id], sec.id);

    const deleteResult = await deleteSection(sec.id);
    expect(deleteResult.deletedSection.name).toBe('Aviation');
    expect(deleteResult.memberships).toHaveLength(2);

    // Verify deleted
    let sections = await getAllSections();
    expect(sections.some((s) => s.id === sec.id)).toBe(false);

    // Undo delete
    await undoDeleteSection(deleteResult);

    sections = await getAllSections();
    expect(sections.some((s) => s.id === sec.id)).toBe(true);

    const words = await getWordsForSection(sec.id);
    expect(words).toHaveLength(2);
  });

  it('15. mergeSections validation: prevents invalid merge targets', async () => {
    const sec1 = await createSection('Test Sec 1');
    const sec2 = await createSection('Test Sec 2');

    // Cannot merge All Words
    await expect(mergeSections(ALL_WORDS_SECTION_ID, sec1.id, false)).rejects.toThrow('Cannot merge');
    await expect(mergeSections(sec1.id, ALL_WORDS_SECTION_ID, false)).rejects.toThrow('Cannot merge');

    // Cannot merge section into itself
    await expect(mergeSections(sec1.id, sec1.id, false)).rejects.toThrow('Cannot merge a section into itself');

    // Non-existent section
    await expect(mergeSections('non_existent', sec2.id, false)).rejects.toThrow('not found');
  });
});
