export interface VocabularyWord {
  id: string;
  word: string;
  wordLower: string; // for unique case-insensitive lookup
  meaning: string;
  example: string;
  options: [string, string, string, string];
  correctIndex: number;
  dateAdded: number;
}

export interface ActiveQuizSession {
  wordId: string;
  word: string;
  meaning: string;
  example: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export type WordQuizPayload = Omit<VocabularyWord, 'id' | 'dateAdded' | 'wordLower'>;

export interface BackendStatus {
  configured: boolean;
  model: string;
  message: string;
}

export type SaveStatusState = 'idle' | 'saving' | 'saved' | 'error';

export interface StorageStatus {
  state: SaveStatusState;
  message: string;
  lastSavedAt?: string;
}
