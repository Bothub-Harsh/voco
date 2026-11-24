import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  VocabularyWord,
  WordQuizPayload,
  ManualWordPayload,
  WordSection,
  WordSectionMembership,
} from '../types';
import { BEGINNER_DISTRACTOR_POOL } from '../services/quizGenerator';

export const ALL_WORDS_SECTION_ID = 'section_all_words';

export const DEFAULT_ALL_WORDS_SECTION: WordSection = {
  id: ALL_WORDS_SECTION_ID,
  name: 'All Words',
  nameLower: 'all words',
  createdAt: 0,
  isDefault: true,
};

export const REMINDER_SECTIONS_STORAGE_KEY = 'voco_reminder_section_ids';

interface MyVocabularyDBSchema extends DBSchema {
  words: {
    key: string;
    value: VocabularyWord;
    indexes: { 'by-word-lower': string };
  };
  sections: {
    key: string;
    value: WordSection;
    indexes: { 'by-name-lower': string };
  };
  word_sections: {
    key: string;
    value: WordSectionMembership;
    indexes: { 'by-word-id': string; 'by-section-id': string };
  };
}

const DB_NAME = 'MyVocabularyDB';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<MyVocabularyDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<MyVocabularyDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<MyVocabularyDBSchema>(DB_NAME, DB_VERSION, {
      async upgrade(db, _oldVersion) {
        if (!db.objectStoreNames.contains('words')) {
          const store = db.createObjectStore('words', { keyPath: 'id' });
          store.createIndex('by-word-lower', 'wordLower', { unique: true });
        }
        if (!db.objectStoreNames.contains('sections')) {
          const secStore = db.createObjectStore('sections', { keyPath: 'id' });
          secStore.createIndex('by-name-lower', 'nameLower', { unique: true });
        }
        if (!db.objectStoreNames.contains('word_sections')) {
          const memberStore = db.createObjectStore('word_sections', { keyPath: 'id' });
          memberStore.createIndex('by-word-id', 'wordId', { unique: false });
          memberStore.createIndex('by-section-id', 'sectionId', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Closes the database connection if open (useful for tests).
 */
export async function closeDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/**
 * Requests persistent storage from the browser to prevent eviction under disk pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch (err) {
      console.warn('Storage persistence request failed:', err);
    }
  }
  return false;
}

/**
 * Retrieves all saved vocabulary words from IndexedDB, sorted with newest first.
 */
export async function getAllWords(): Promise<VocabularyWord[]> {
  const db = await getDB();
  const words = await db.getAll('words');
  return words.sort((a, b) => b.dateAdded - a.dateAdded);
}

/**
 * Retrieves a single word by its unique ID.
 */
export async function getWordById(id: string): Promise<VocabularyWord | undefined> {
  const db = await getDB();
  return db.get('words', id);
}

/**
 * Retrieves a word by its spelling (case-insensitive).
 */
export async function getWordByName(name: string): Promise<VocabularyWord | undefined> {
  const db = await getDB();
  const tx = db.transaction('words', 'readonly');
  const index = tx.store.index('by-word-lower');
  return index.get(name.trim().toLowerCase());
}

/**
 * Validates a word quiz payload before saving.
 */
export function validateWordPayload(payload: WordQuizPayload): void {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Word data must be an object.');
  }
  if (!payload.word || typeof payload.word !== 'string' || !payload.word.trim()) {
    throw new Error('Word spelling cannot be empty.');
  }
  if (!payload.meaning || typeof payload.meaning !== 'string' || !payload.meaning.trim()) {
    throw new Error('Word meaning cannot be empty.');
  }
  if (!payload.example || typeof payload.example !== 'string' || !payload.example.trim()) {
    throw new Error('Example sentence cannot be empty.');
  }
  if (!Array.isArray(payload.options) || payload.options.length !== 4) {
    throw new Error('Word quiz must have exactly 4 multiple-choice options.');
  }
  for (let i = 0; i < payload.options.length; i++) {
    if (!payload.options[i] || typeof payload.options[i] !== 'string' || !payload.options[i].trim()) {
      throw new Error(`Option ${i + 1} cannot be empty.`);
    }
  }
  const parsedIndex = Number(payload.correctIndex);
  if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex > 3) {
    throw new Error('Correct answer index must be an integer between 0 and 3.');
  }
}

/**
 * Saves a new vocabulary item into IndexedDB.
 * Awaits full transaction completion (tx.done) to ensure data is committed to disk.
 * Prevents accidental duplicate entries (case-insensitive).
 */
export async function saveWord(payload: WordQuizPayload): Promise<VocabularyWord> {
  validateWordPayload(payload);

  const db = await getDB();
  const cleanWord = payload.word.trim();
  const wordLower = cleanWord.toLowerCase();

  // Check for duplicate word (case-insensitive)
  const existing = await getWordByName(wordLower);
  if (existing) {
    throw new Error(`"${cleanWord}" is already in your vocabulary list.`);
  }

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `word_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const newWord: VocabularyWord = {
    id,
    word: cleanWord,
    wordLower,
    meaning: payload.meaning.trim(),
    example: payload.example.trim(),
    hindiMeaning: payload.hindiMeaning?.trim() || undefined,
    hindiExample: payload.hindiExample?.trim() || undefined,
    options: payload.options.map((opt) => opt.trim()) as [string, string, string, string],
    correctIndex: Number(payload.correctIndex),
    dateAdded: Date.now(),
  };

  try {
    const tx = db.transaction('words', 'readwrite');
    await tx.store.put(newWord);
    await tx.done; // Ensure transaction completes
    return newWord;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'QuotaExceededError') {
      throw new Error('Browser storage quota exceeded. Please export a backup and delete unused words.');
    }
    throw new Error(`Failed to write word to IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Saves a manually entered vocabulary word into IndexedDB.
 * Generates initial distinct distractors and randomizes the answer position.
 * Prevents accidental duplicate entries (case-insensitive).
 */
export async function saveManualWord(payload: ManualWordPayload): Promise<VocabularyWord> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Word data must be an object.');
  }

  const cleanWord = payload.word ? payload.word.trim() : '';
  if (!cleanWord) {
    throw new Error('Word spelling cannot be empty.');
  }

  const cleanMeaning = payload.meaning ? payload.meaning.trim() : '';
  if (!cleanMeaning) {
    throw new Error('Word meaning cannot be empty.');
  }

  const cleanExample = payload.example?.trim() || `Example: "${cleanWord}" is used in everyday conversation.`;

  const db = await getDB();
  const wordLower = cleanWord.toLowerCase();

  // Check duplicate
  const existing = await getWordByName(wordLower);
  if (existing) {
    throw new Error(`"${cleanWord}" is already in your vocabulary list.`);
  }

  // Gather distractors for initial quiz options
  const allWords = await getAllWords();
  const distractors: string[] = [];
  const seenNorm = new Set<string>();
  const norm = (s: string) => s.trim().toLowerCase().replace(/[.,!?;:'"()[\]{}]/g, '');
  seenNorm.add(norm(cleanMeaning));

  // 1. From other saved words
  for (const w of allWords) {
    const wNorm = norm(w.meaning);
    if (!seenNorm.has(wNorm)) {
      seenNorm.add(wNorm);
      distractors.push(w.meaning.trim());
      if (distractors.length >= 3) break;
    }
  }

  // 2. From beginner distractor pool
  if (distractors.length < 3) {
    for (const poolItem of BEGINNER_DISTRACTOR_POOL) {
      const pNorm = norm(poolItem);
      if (!seenNorm.has(pNorm)) {
        seenNorm.add(pNorm);
        distractors.push(poolItem);
        if (distractors.length >= 3) break;
      }
    }
  }

  // Combine and shuffle choices
  const choices = [cleanMeaning, distractors[0], distractors[1], distractors[2]];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  const correctIndex = choices.indexOf(cleanMeaning);

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `word_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const newWord: VocabularyWord = {
    id,
    word: cleanWord,
    wordLower,
    meaning: cleanMeaning,
    example: cleanExample,
    hindiMeaning: payload.hindiMeaning?.trim() || undefined,
    hindiExample: payload.hindiExample?.trim() || undefined,
    options: choices as [string, string, string, string],
    correctIndex,
    dateAdded: Date.now(),
    isCustomMeaning: true,
  };

  try {
    const tx = db.transaction('words', 'readwrite');
    await tx.store.put(newWord);
    await tx.done; // Ensure transaction completes
    return newWord;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'QuotaExceededError') {
      throw new Error('Browser storage quota exceeded. Please export a backup and delete unused words.');
    }
    throw new Error(`Failed to write word to IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Updates an existing word in IndexedDB and awaits transaction completion.
 */
export async function updateWord(updatedWord: VocabularyWord): Promise<VocabularyWord> {
  validateWordPayload(updatedWord);

  const db = await getDB();
  const cleanWord = updatedWord.word.trim();
  const wordLower = cleanWord.toLowerCase();

  // Ensure no other word has the same spelling
  const existing = await getWordByName(wordLower);
  if (existing && existing.id !== updatedWord.id) {
    throw new Error(`Another word with the spelling "${cleanWord}" already exists.`);
  }

  const wordToStore: VocabularyWord = {
    ...updatedWord,
    word: cleanWord,
    wordLower,
    meaning: updatedWord.meaning.trim(),
    example: updatedWord.example.trim(),
    hindiMeaning: updatedWord.hindiMeaning?.trim() || undefined,
    hindiExample: updatedWord.hindiExample?.trim() || undefined,
    options: updatedWord.options.map((opt) => opt.trim()) as [string, string, string, string],
    correctIndex: Number(updatedWord.correctIndex),
  };

  try {
    const tx = db.transaction('words', 'readwrite');
    await tx.store.put(wordToStore);
    await tx.done; // Ensure transaction completes
    return wordToStore;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'QuotaExceededError') {
      throw new Error('Browser storage quota exceeded. Please export a backup and delete unused words.');
    }
    throw new Error(`Failed to update word in IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Deletes a word by its unique ID and cleans up its section memberships.
 */
export async function deleteWord(id: string): Promise<void> {
  const db = await getDB();
  try {
    const tx = db.transaction(['words', 'word_sections'], 'readwrite');
    await tx.objectStore('words').delete(id);
    const memberIndex = tx.objectStore('word_sections').index('by-word-id');
    const memberKeys = await memberIndex.getAllKeys(id);
    for (const key of memberKeys) {
      await tx.objectStore('word_sections').delete(key);
    }
    await tx.done; // Ensure transaction completes
  } catch (err) {
    throw new Error(`Failed to delete word from IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Deletes multiple words in a single atomic IndexedDB transaction and cleans up section memberships.
 */
export async function deleteWords(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const db = await getDB();
  try {
    const tx = db.transaction(['words', 'word_sections'], 'readwrite');
    const wordsStore = tx.objectStore('words');
    const memberStore = tx.objectStore('word_sections');
    const memberIndex = memberStore.index('by-word-id');

    for (const id of ids) {
      await wordsStore.delete(id);
      const memberKeys = await memberIndex.getAllKeys(id);
      for (const key of memberKeys) {
        await memberStore.delete(key);
      }
    }
    await tx.done;
  } catch (err) {
    throw new Error(`Failed to delete words from IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─────────────────────────────────────────────────────────────
// ── Word Sections Store & Membership Management ─────────────
// ─────────────────────────────────────────────────────────────

/**
 * Retrieves all sections. Guarantees that "All Words" is always the first section.
 */
export async function getAllSections(): Promise<WordSection[]> {
  const db = await getDB();
  const list = await db.getAll('sections');
  const userSections = list
    .filter((s) => s.id !== ALL_WORDS_SECTION_ID)
    .sort((a, b) => a.createdAt - b.createdAt);
  return [DEFAULT_ALL_WORDS_SECTION, ...userSections];
}

/**
 * Creates a new user section with unique, trimmed case-insensitive name (max 30 chars).
 */
export async function createSection(name: string, color?: string): Promise<WordSection> {
  const trimmed = name ? name.trim() : '';
  if (!trimmed) {
    throw new Error('Section name cannot be empty.');
  }
  if (trimmed.length > 30) {
    throw new Error('Section name cannot exceed 30 characters.');
  }

  const nameLower = trimmed.toLowerCase();
  if (nameLower === 'all words' || nameLower === 'all') {
    throw new Error('"All Words" is a reserved default section name.');
  }

  const db = await getDB();
  const existing = await db.getFromIndex('sections', 'by-name-lower', nameLower);
  if (existing) {
    throw new Error(`A section named "${trimmed}" already exists.`);
  }

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? `sec_${crypto.randomUUID()}`
    : `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newSection: WordSection = {
    id,
    name: trimmed,
    nameLower,
    color,
    createdAt: Date.now(),
    isDefault: false,
  };

  const tx = db.transaction('sections', 'readwrite');
  await tx.store.put(newSection);
  await tx.done;
  return newSection;
}

/**
 * Renames an existing user section.
 */
export async function renameSection(sectionId: string, newName: string): Promise<WordSection> {
  if (sectionId === ALL_WORDS_SECTION_ID) {
    throw new Error('The default "All Words" section cannot be renamed.');
  }

  const trimmed = newName ? newName.trim() : '';
  if (!trimmed) {
    throw new Error('Section name cannot be empty.');
  }
  if (trimmed.length > 30) {
    throw new Error('Section name cannot exceed 30 characters.');
  }

  const nameLower = trimmed.toLowerCase();
  if (nameLower === 'all words' || nameLower === 'all') {
    throw new Error('"All Words" is a reserved default section name.');
  }

  const db = await getDB();
  const existing = await db.get('sections', sectionId);
  if (!existing) {
    throw new Error('Section not found.');
  }

  // Check unique name among other sections
  const duplicate = await db.getFromIndex('sections', 'by-name-lower', nameLower);
  if (duplicate && duplicate.id !== sectionId) {
    throw new Error(`A section named "${trimmed}" already exists.`);
  }

  const updated: WordSection = {
    ...existing,
    name: trimmed,
    nameLower,
  };

  const tx = db.transaction('sections', 'readwrite');
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export interface MergeSectionResult {
  sourceSection: WordSection;
  targetSection: WordSection;
  wordsMovedCount: number;
  addedWordIds: string[];
  deletedSource: boolean;
  sourceMemberships: WordSectionMembership[];
  previousReminderSelectedIds: string[];
}

export interface DeleteSectionResult {
  deletedSection: WordSection;
  memberships: WordSectionMembership[];
  previousReminderSelectedIds: string[];
}

/**
 * Merges source section into target section.
 * Adds all words from source to target without duplicates.
 * Words and meanings are NEVER deleted or modified.
 * Performed in a single atomic IndexedDB transaction.
 */
export async function mergeSections(
  sourceId: string,
  targetId: string,
  deleteSource: boolean
): Promise<MergeSectionResult> {
  if (sourceId === ALL_WORDS_SECTION_ID || targetId === ALL_WORDS_SECTION_ID) {
    throw new Error('Cannot merge the default "All Words" section.');
  }
  if (sourceId === targetId) {
    throw new Error('Cannot merge a section into itself.');
  }

  const db = await getDB();
  const sourceSec = await db.get('sections', sourceId);
  const targetSec = await db.get('sections', targetId);

  if (!sourceSec) {
    throw new Error('Source section not found.');
  }
  if (!targetSec) {
    throw new Error('Target section not found.');
  }

  const tx = db.transaction(['sections', 'word_sections'], 'readwrite');
  const memberStore = tx.objectStore('word_sections');
  const index = memberStore.index('by-section-id');

  const sourceMemberships: WordSectionMembership[] = await index.getAll(sourceId);
  const targetMemberships: WordSectionMembership[] = await index.getAll(targetId);
  const targetWordIds = new Set(targetMemberships.map((m) => m.wordId));

  const addedWordIds: string[] = [];
  const now = Date.now();

  for (const sm of sourceMemberships) {
    if (!targetWordIds.has(sm.wordId)) {
      const newMembership: WordSectionMembership = {
        id: `${sm.wordId}___${targetId}`,
        wordId: sm.wordId,
        sectionId: targetId,
        createdAt: now,
      };
      await memberStore.put(newMembership);
      addedWordIds.push(sm.wordId);
      targetWordIds.add(sm.wordId);
    }
  }

  if (deleteSource) {
    await tx.objectStore('sections').delete(sourceId);
    const sourceKeys = await index.getAllKeys(sourceId);
    for (const k of sourceKeys) {
      await memberStore.delete(k);
    }
  }

  await tx.done;

  // Reminder selection sync
  const prevReminderIds = getReminderSelectedSectionIds();
  let nextReminderIds = [...prevReminderIds];
  if (prevReminderIds.includes(sourceId)) {
    if (!nextReminderIds.includes(targetId)) {
      nextReminderIds.push(targetId);
    }
    if (deleteSource) {
      nextReminderIds = nextReminderIds.filter((id) => id !== sourceId);
    }
    if (nextReminderIds.length === 0) {
      nextReminderIds = [ALL_WORDS_SECTION_ID];
    }
    setReminderSelectedSectionIds(nextReminderIds);
  }

  return {
    sourceSection: sourceSec,
    targetSection: targetSec,
    wordsMovedCount: addedWordIds.length,
    addedWordIds,
    deletedSource: deleteSource,
    sourceMemberships,
    previousReminderSelectedIds: prevReminderIds,
  };
}

/**
 * Reverts a previous merge operation in one atomic transaction.
 */
export async function undoMergeSections(result: MergeSectionResult): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sections', 'word_sections'], 'readwrite');
  const memberStore = tx.objectStore('word_sections');

  // 1. Remove words that were newly added to target by this merge
  for (const wordId of result.addedWordIds) {
    await memberStore.delete(`${wordId}___${result.targetSection.id}`);
  }

  // 2. If source section was deleted, restore it and all its memberships
  if (result.deletedSource) {
    await tx.objectStore('sections').put(result.sourceSection);
    for (const sm of result.sourceMemberships) {
      await memberStore.put(sm);
    }
  }

  await tx.done;

  // 3. Restore reminder selected section IDs
  setReminderSelectedSectionIds(result.previousReminderSelectedIds);
}

/**
 * Deletes a section. Never deletes the words themselves.
 * Cleans up memberships and adjusts reminder selection if necessary.
 * Returns metadata needed to undo the deletion.
 */
export async function deleteSection(sectionId: string): Promise<DeleteSectionResult> {
  if (sectionId === ALL_WORDS_SECTION_ID) {
    throw new Error('The default "All Words" section cannot be deleted.');
  }

  const db = await getDB();
  const sec = await db.get('sections', sectionId);
  if (!sec) {
    throw new Error('Section not found.');
  }

  const tx = db.transaction(['sections', 'word_sections'], 'readwrite');
  const memberStore = tx.objectStore('word_sections');
  const index = memberStore.index('by-section-id');

  const memberships: WordSectionMembership[] = await index.getAll(sectionId);
  const keys = await index.getAllKeys(sectionId);

  await tx.objectStore('sections').delete(sectionId);
  for (const k of keys) {
    await memberStore.delete(k);
  }
  await tx.done;

  // Clean from reminder selected sections if present
  const prevReminderIds = getReminderSelectedSectionIds();
  if (prevReminderIds.includes(sectionId)) {
    const filtered = prevReminderIds.filter((id) => id !== sectionId);
    setReminderSelectedSectionIds(filtered.length > 0 ? filtered : [ALL_WORDS_SECTION_ID]);
  }

  return {
    deletedSection: sec,
    memberships,
    previousReminderSelectedIds: prevReminderIds,
  };
}

/**
 * Reverts a section deletion in one atomic transaction.
 */
export async function undoDeleteSection(result: DeleteSectionResult): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['sections', 'word_sections'], 'readwrite');
  await tx.objectStore('sections').put(result.deletedSection);
  const memberStore = tx.objectStore('word_sections');
  for (const m of result.memberships) {
    await memberStore.put(m);
  }
  await tx.done;

  setReminderSelectedSectionIds(result.previousReminderSelectedIds);
}

/**
 * Computes word counts for all sections.
 */
export async function getSectionWordCounts(): Promise<Record<string, number>> {
  const db = await getDB();
  const allWords = await db.getAll('words');
  const totalCount = allWords.length;

  const validWordIds = new Set(allWords.map((w) => w.id));
  const counts: Record<string, number> = {
    [ALL_WORDS_SECTION_ID]: totalCount,
  };

  const memberships = await db.getAll('word_sections');
  for (const m of memberships) {
    if (validWordIds.has(m.wordId)) {
      counts[m.sectionId] = (counts[m.sectionId] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Retrieves words belonging to a specific section, newest first.
 * For "All Words", returns all saved words.
 */
export async function getWordsForSection(sectionId: string): Promise<VocabularyWord[]> {
  const allWords = await getAllWords();
  if (!sectionId || sectionId === ALL_WORDS_SECTION_ID) {
    return allWords;
  }

  const db = await getDB();
  const memberships = await db.getAllFromIndex('word_sections', 'by-section-id', sectionId);
  const targetIds = new Set(memberships.map((m) => m.wordId));

  return allWords.filter((w) => targetIds.has(w.id));
}

/**
 * Gets section IDs for a specific word (always includes ALL_WORDS_SECTION_ID).
 */
export async function getWordSectionIds(wordId: string): Promise<string[]> {
  const db = await getDB();
  const memberships = await db.getAllFromIndex('word_sections', 'by-word-id', wordId);
  const ids = memberships.map((m) => m.sectionId);
  return [ALL_WORDS_SECTION_ID, ...ids];
}

/**
 * Gets a full mapping of wordId -> sectionIds for all words.
 */
export async function getWordSectionMapping(): Promise<Record<string, string[]>> {
  const db = await getDB();
  const memberships = await db.getAll('word_sections');
  const mapping: Record<string, string[]> = {};
  for (const m of memberships) {
    if (!mapping[m.wordId]) {
      mapping[m.wordId] = [ALL_WORDS_SECTION_ID];
    }
    if (!mapping[m.wordId].includes(m.sectionId)) {
      mapping[m.wordId].push(m.sectionId);
    }
  }
  return mapping;
}

/**
 * Links a word to a section.
 */
export async function addWordToSection(wordId: string, sectionId: string): Promise<void> {
  if (!sectionId || sectionId === ALL_WORDS_SECTION_ID) return;
  const db = await getDB();
  const id = `${wordId}___${sectionId}`;
  const membership: WordSectionMembership = {
    id,
    wordId,
    sectionId,
    createdAt: Date.now(),
  };
  const tx = db.transaction('word_sections', 'readwrite');
  await tx.store.put(membership);
  await tx.done;
}

/**
 * Removes a word from a section.
 */
export async function removeWordFromSection(wordId: string, sectionId: string): Promise<void> {
  if (!sectionId || sectionId === ALL_WORDS_SECTION_ID) return;
  const db = await getDB();
  const id = `${wordId}___${sectionId}`;
  const tx = db.transaction('word_sections', 'readwrite');
  await tx.store.delete(id);
  await tx.done;
}

/**
 * Adds multiple words to a section in a single transaction.
 */
export async function addWordsToSection(wordIds: string[], sectionId: string): Promise<void> {
  if (!sectionId || sectionId === ALL_WORDS_SECTION_ID || !wordIds.length) return;
  const db = await getDB();
  const tx = db.transaction('word_sections', 'readwrite');
  for (const wordId of wordIds) {
    const id = `${wordId}___${sectionId}`;
    await tx.store.put({
      id,
      wordId,
      sectionId,
      createdAt: Date.now(),
    });
  }
  await tx.done;
}

/**
 * Removes multiple words from a section in a single transaction.
 */
export async function removeWordsFromSection(wordIds: string[], sectionId: string): Promise<void> {
  if (!sectionId || sectionId === ALL_WORDS_SECTION_ID || !wordIds.length) return;
  const db = await getDB();
  const tx = db.transaction('word_sections', 'readwrite');
  for (const wordId of wordIds) {
    const id = `${wordId}___${sectionId}`;
    await tx.store.delete(id);
  }
  await tx.done;
}

/**
 * Sets the exact list of user sections for a word.
 */
export async function setWordSections(wordId: string, sectionIds: string[]): Promise<void> {
  const db = await getDB();
  const targetIds = new Set(sectionIds.filter((s) => s && s !== ALL_WORDS_SECTION_ID));

  const tx = db.transaction('word_sections', 'readwrite');
  const index = tx.store.index('by-word-id');
  const currentMemberships = await index.getAll(wordId);

  // Remove memberships no longer selected
  for (const m of currentMemberships) {
    if (!targetIds.has(m.sectionId)) {
      await tx.store.delete(m.id);
    } else {
      targetIds.delete(m.sectionId); // already exists
    }
  }

  // Add new memberships
  for (const secId of targetIds) {
    await tx.store.put({
      id: `${wordId}___${secId}`,
      wordId,
      sectionId: secId,
      createdAt: Date.now(),
    });
  }

  await tx.done;
}

// ─────────────────────────────────────────────────────────────
// ── Reminder Section Selection & Word Pool ──────────────────
// ─────────────────────────────────────────────────────────────

export function getReminderSelectedSectionIds(): string[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(REMINDER_SECTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (ignored) { }
  return [ALL_WORDS_SECTION_ID];
}

export function setReminderSelectedSectionIds(ids: string[]): void {
  try {
    const valid = Array.isArray(ids) && ids.length > 0 ? ids : [ALL_WORDS_SECTION_ID];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REMINDER_SECTIONS_STORAGE_KEY, JSON.stringify(valid));
    }
  } catch (ignored) { }
}

/**
 * Computes the deduplicated pool of vocabulary words feeding reminders,
 * based on selected section IDs. If "All Words" is selected, includes all words.
 */
export async function getReminderWordPool(selectedSectionIds?: string[]): Promise<VocabularyWord[]> {
  const sections = selectedSectionIds && selectedSectionIds.length > 0
    ? selectedSectionIds
    : getReminderSelectedSectionIds();

  const allWords = await getAllWords();
  if (sections.includes(ALL_WORDS_SECTION_ID)) {
    return allWords;
  }

  const db = await getDB();
  const wordIdSet = new Set<string>();

  for (const secId of sections) {
    const memberships = await db.getAllFromIndex('word_sections', 'by-section-id', secId);
    for (const m of memberships) {
      wordIdSet.add(m.wordId);
    }
  }

  return allWords.filter((w) => wordIdSet.has(w.id));
}

// ─────────────────────────────────────────────────────────────
// ── Export / Import Backup JSON with Sections ───────────────
// ─────────────────────────────────────────────────────────────

/**
 * Exports all saved words, sections, memberships and reminder selection to JSON.
 */
export async function exportBackupJson(): Promise<string> {
  const words = await getAllWords();
  const db = await getDB();
  const sections = await db.getAll('sections');
  const memberships = await db.getAll('word_sections');
  const reminderSelection = getReminderSelectedSectionIds();

  const backupData = {
    appName: 'My Vocabulary',
    version: 2,
    exportedAt: new Date().toISOString(),
    totalWords: words.length,
    words,
    sections: sections.filter((s) => s.id !== ALL_WORDS_SECTION_ID),
    wordSections: memberships,
    memberships,
    reminderSelectedSectionIds: reminderSelection,
    reminderSelection,
  };
  return JSON.stringify(backupData, null, 2);
}

/**
 * Imports words and sections from a JSON backup string with strict validation.
 * Safely merges old backups without sections (all words go to All Words) and
 * new backups with sections without duplicating words or sections.
 */
export async function importBackupJson(
  jsonString: string
): Promise<{
  importedCount: number;
  skippedCount: number;
  sectionsImported: number;
  errors: string[];
}> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('The backup file is not valid JSON.');
  }

  let wordsToImport: unknown[] = [];
  let sectionsToImport: unknown[] = [];
  let membershipsToImport: unknown[] = [];
  let reminderSelectionToImport: unknown[] = [];

  if (Array.isArray(parsed)) {
    // Old raw array backup
    wordsToImport = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.words)) {
      wordsToImport = obj.words;
    } else {
      throw new Error('Unrecognized backup format. Expected a list of words.');
    }
    if (Array.isArray(obj.sections)) {
      sectionsToImport = obj.sections;
    }
    if (Array.isArray(obj.wordSections)) {
      membershipsToImport = obj.wordSections;
    } else if (Array.isArray(obj.memberships)) {
      membershipsToImport = obj.memberships;
    }
    if (Array.isArray(obj.reminderSelectedSectionIds)) {
      reminderSelectionToImport = obj.reminderSelectedSectionIds;
    } else if (Array.isArray(obj.reminderSelection)) {
      reminderSelectionToImport = obj.reminderSelection;
    }
  } else {
    throw new Error('Unrecognized backup format. Expected a list of words.');
  }

  const db = await getDB();
  let importedCount = 0;
  let skippedCount = 0;
  let sectionsImported = 0;
  const errors: string[] = [];

  // 1. Import Words
  const wordIdMap = new Map<string, string>(); // oldWordId -> finalWordId

  for (let index = 0; index < wordsToImport.length; index++) {
    const raw = wordsToImport[index];
    try {
      if (!raw || typeof raw !== 'object') {
        throw new Error('Item is not an object.');
      }

      const item = raw as Partial<VocabularyWord>;
      validateWordPayload(item as WordQuizPayload);

      const wordLower = item.word!.trim().toLowerCase();
      const existing = await getWordByName(wordLower);
      if (existing) {
        skippedCount++;
        if (item.id) {
          wordIdMap.set(item.id, existing.id);
        }
        continue;
      }

      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `word_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const finalId = item.id || id;
      const newWord: VocabularyWord = {
        id: finalId,
        word: item.word!.trim(),
        wordLower,
        meaning: item.meaning!.trim(),
        example: item.example!.trim(),
        hindiMeaning: item.hindiMeaning?.trim() || undefined,
        hindiExample: item.hindiExample?.trim() || undefined,
        options: item.options!.map((o) => o.trim()) as [string, string, string, string],
        correctIndex: Number(item.correctIndex),
        dateAdded: item.dateAdded || Date.now(),
      };

      const tx = db.transaction('words', 'readwrite');
      await tx.store.put(newWord);
      await tx.done;

      if (item.id) {
        wordIdMap.set(item.id, finalId);
      }
      importedCount++;
    } catch (err) {
      errors.push(`Item ${index + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Import Sections (merged by case-insensitive name)
  const sectionIdMap = new Map<string, string>(); // oldSecId -> currentSecId
  sectionIdMap.set(ALL_WORDS_SECTION_ID, ALL_WORDS_SECTION_ID);

  const existingSections = await getAllSections();
  const nameToExistingSec = new Map<string, WordSection>();
  for (const s of existingSections) {
    nameToExistingSec.set(s.nameLower, s);
  }

  for (const rawSec of sectionsToImport) {
    if (!rawSec || typeof rawSec !== 'object') continue;
    const sec = rawSec as Partial<WordSection>;
    const name = sec.name ? sec.name.trim() : '';
    if (!name) continue;
    const nameLower = name.toLowerCase();
    if (nameLower === 'all words' || nameLower === 'all') {
      if (sec.id) sectionIdMap.set(sec.id, ALL_WORDS_SECTION_ID);
      continue;
    }

    if (nameToExistingSec.has(nameLower)) {
      const match = nameToExistingSec.get(nameLower)!;
      if (sec.id) sectionIdMap.set(sec.id, match.id);
    } else {
      try {
        const created = await createSection(name, sec.color);
        nameToExistingSec.set(nameLower, created);
        if (sec.id) sectionIdMap.set(sec.id, created.id);
        sectionsImported++;
      } catch (err) {
        // Section creation failure shouldn't fail the whole import
      }
    }
  }

  // 3. Import Memberships
  if (membershipsToImport.length > 0) {
    const tx = db.transaction('word_sections', 'readwrite');
    for (const rawM of membershipsToImport) {
      if (!rawM || typeof rawM !== 'object') continue;
      const m = rawM as { wordId?: string; sectionId?: string };
      if (!m.wordId || !m.sectionId) continue;

      const targetWordId = wordIdMap.get(m.wordId) || m.wordId;
      const targetSecId = sectionIdMap.get(m.sectionId) || m.sectionId;

      if (targetSecId === ALL_WORDS_SECTION_ID) continue; // universal

      const linkId = `${targetWordId}___${targetSecId}`;
      await tx.store.put({
        id: linkId,
        wordId: targetWordId,
        sectionId: targetSecId,
        createdAt: Date.now(),
      });
    }
    await tx.done;
  }

  // 4. Update reminderSelection if valid
  if (reminderSelectionToImport.length > 0) {
    const mappedSelection: string[] = [];
    for (const rawId of reminderSelectionToImport) {
      const idStr = String(rawId);
      const mapped = sectionIdMap.get(idStr) || (idStr === ALL_WORDS_SECTION_ID ? ALL_WORDS_SECTION_ID : null);
      if (mapped && !mappedSelection.includes(mapped)) {
        mappedSelection.push(mapped);
      }
    }
    if (mappedSelection.length > 0) {
      setReminderSelectedSectionIds(mappedSelection);
    }
  }

  return { importedCount, skippedCount, sectionsImported, errors };
}

/**
 * Migrates any legacy words found in localStorage into IndexedDB without deleting the original data.
 */
export async function migrateFromLocalStorageIfPresent(): Promise<{ migratedCount: number }> {
  if (typeof localStorage === 'undefined') return { migratedCount: 0 };

  const candidateKeys = ['my_vocabulary_words', 'saved_words', 'my_vocab_words', 'vocab_words'];
  let totalMigrated = 0;

  for (const key of candidateKeys) {
    const rawData = localStorage.getItem(key);
    if (!rawData) continue;

    try {
      const parsed = JSON.parse(rawData);
      const items: unknown[] = Array.isArray(parsed) ? parsed : (parsed?.words && Array.isArray(parsed.words) ? parsed.words : []);

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const candidate = item as Partial<VocabularyWord>;
        if (!candidate.word || !candidate.meaning || !candidate.example || !Array.isArray(candidate.options) || candidate.options.length !== 4) {
          continue;
        }

        const wordLower = candidate.word.trim().toLowerCase();
        const existing = await getWordByName(wordLower);
        if (!existing) {
          const id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `word_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          const newWord: VocabularyWord = {
            id: candidate.id || id,
            word: candidate.word.trim(),
            wordLower,
            meaning: candidate.meaning.trim(),
            example: candidate.example.trim(),
            options: candidate.options.map((o) => String(o).trim()) as [string, string, string, string],
            correctIndex: Number(candidate.correctIndex ?? 0),
            dateAdded: candidate.dateAdded || Date.now(),
          };

          const db = await getDB();
          const tx = db.transaction('words', 'readwrite');
          await tx.store.put(newWord);
          await tx.done;
          totalMigrated++;
        }
      }
    } catch {
      // Do not disrupt app if a key has non-JSON content
    }
  }

  return { migratedCount: totalMigrated };
}

/**
 * Optional helper to seed a starter word if the database is brand new.
 */
export async function seedInitialWordIfEmpty(): Promise<VocabularyWord | null> {
  const words = await getAllWords();
  if (words.length === 0) {
    const sample: WordQuizPayload = {
      word: 'Harsh',
      meaning: '**Harsh** means being **unpleasantly rough**, **cruel**, or **very severe** in tone or behavior.',
      example: 'The teacher was harsh with the students.',
      hindiMeaning: 'कठोर / अप्रिय रूप से सख्त।',
      hindiExample: 'शिक्षक छात्रों के प्रति कठोर थे।',
      options: [
        'Kind and caring',
        'unpleasantly rough, cruel, or very severe',
        'Very happy',
        'Tired and sleepy',
      ],
      correctIndex: 1,
    };
    return await saveWord(sample);
  }
  return null;
}
