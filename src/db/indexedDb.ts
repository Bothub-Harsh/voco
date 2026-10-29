import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { VocabularyWord, WordQuizPayload } from '../types';

interface MyVocabularyDBSchema extends DBSchema {
  words: {
    key: string;
    value: VocabularyWord;
    indexes: { 'by-word-lower': string };
  };
}

const DB_NAME = 'MyVocabularyDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MyVocabularyDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<MyVocabularyDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<MyVocabularyDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('words')) {
          const store = db.createObjectStore('words', { keyPath: 'id' });
          store.createIndex('by-word-lower', 'wordLower', { unique: true });
        }
      },
    });
  }
  return dbPromise;
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
 * Deletes a word by its unique ID and awaits transaction completion.
 */
export async function deleteWord(id: string): Promise<void> {
  const db = await getDB();
  try {
    const tx = db.transaction('words', 'readwrite');
    await tx.store.delete(id);
    await tx.done; // Ensure transaction completes
  } catch (err) {
    throw new Error(`Failed to delete word from IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Exports all saved words to a downloadable JSON string.
 */
export async function exportBackupJson(): Promise<string> {
  const words = await getAllWords();
  const backupData = {
    appName: 'My Vocabulary',
    version: 1,
    exportedAt: new Date().toISOString(),
    totalWords: words.length,
    words,
  };
  return JSON.stringify(backupData, null, 2);
}

/**
 * Imports words from a JSON backup string with strict validation.
 * Avoids overwriting or duplicating existing words.
 */
export async function importBackupJson(
  jsonString: string
): Promise<{ importedCount: number; skippedCount: number; errors: string[] }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('The backup file is not valid JSON.');
  }

  let wordsToImport: unknown[] = [];
  if (Array.isArray(parsed)) {
    wordsToImport = parsed;
  } else if (parsed && typeof parsed === 'object' && 'words' in parsed && Array.isArray((parsed as { words: unknown }).words)) {
    wordsToImport = (parsed as { words: unknown[] }).words;
  } else {
    throw new Error('Unrecognized backup format. Expected a list of words.');
  }

  const db = await getDB();
  let importedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

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
        continue;
      }

      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `word_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const newWord: VocabularyWord = {
        id: item.id || id,
        word: item.word!.trim(),
        wordLower,
        meaning: item.meaning!.trim(),
        example: item.example!.trim(),
        options: item.options!.map((o) => o.trim()) as [string, string, string, string],
        correctIndex: Number(item.correctIndex),
        dateAdded: item.dateAdded || Date.now(),
      };

      const tx = db.transaction('words', 'readwrite');
      await tx.store.put(newWord);
      await tx.done;
      importedCount++;
    } catch (err) {
      errors.push(`Item ${index + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { importedCount, skippedCount, errors };
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
      meaning: 'Rough, unkind, or very severe.',
      example: 'The teacher was harsh with the students.',
      options: [
        'Kind and caring',
        'Rough or unkind',
        'Very happy',
        'Tired and sleepy',
      ],
      correctIndex: 1,
    };
    return await saveWord(sample);
  }
  return null;
}
