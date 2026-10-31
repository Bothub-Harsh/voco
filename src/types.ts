export interface VocabularyWord {
  id: string;
  word: string;
  wordLower: string; // for unique case-insensitive lookup
  meaning: string;
  example: string;
  hindiMeaning?: string; // Clear, natural Hindi translation
  hindiExample?: string; // Hindi translation of the example sentence
  options: [string, string, string, string];
  correctIndex: number;
  dateAdded: number;
  isCustomMeaning?: boolean; // true if user wrote their own meaning
}

export interface ManualWordPayload {
  word: string;
  meaning: string;
  example?: string;
  hindiMeaning?: string;
  hindiExample?: string;
}

export interface ActiveQuizSession {
  wordId: string;
  word: string;
  meaning: string;
  example: string;
  hindiMeaning?: string;
  hindiExample?: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export type WordQuizPayload = Omit<VocabularyWord, 'id' | 'dateAdded' | 'wordLower'>;

export interface BackendStatus {
  configured: boolean;
  model: string;
  message: string;
  reachable: boolean;
}

export type SaveStatusState = 'idle' | 'saving' | 'saved' | 'error';

export interface StorageStatus {
  state: SaveStatusState;
  message: string;
  lastSavedAt?: string;
}
