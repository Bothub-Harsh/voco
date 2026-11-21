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

export type BackendConnectionState =
  | 'checking'
  | 'online'
  | 'waking'
  | 'down'
  | 'offline'
  | 'ai_problem'
  | 'connected'
  | 'unavailable';

export interface BackendStatus {
  configured: boolean;
  model: string;
  message: string;
  reachable: boolean;
  state?: BackendConnectionState;
  responseTimeMs?: number;
  serverStartTime?: string;
  serverTime?: string;
  uptimeSeconds?: number;
  lastPingAt?: string;
  lastCheckedAt?: number;
  errorDetail?: string;
}

export type SaveStatusState = 'idle' | 'saving' | 'saved' | 'error';

export interface StorageStatus {
  state: SaveStatusState;
  message: string;
  lastSavedAt?: string;
}

export type GenerationErrorType =
  | 'RATE_LIMIT'       // HTTP 429
  | 'SERVER_ERROR'     // HTTP 5xx
  | 'NETWORK_FAILURE'  // Network timeout (30-45s) or drop
  | 'MALFORMED_JSON'   // AI returned unparseable text
  | 'MISSING_FIELDS';  // Response missing required definition/options

export interface BulkWordFailure {
  word: string;
  type: GenerationErrorType;
  reason: string;
}

export interface PracticeAllSession {
  words: VocabularyWord[];      // All words to practice (shuffled)
  currentIndex: number;         // Index of current word
  answers: { wordId: string; correct: boolean }[];  // Track answers
  allSavedWords: VocabularyWord[];  // For quiz option generation
}

export interface DailyScheduleConfig {
  enabled: boolean;
  startTime: string; // "HH:mm" 24h format (e.g. "08:00")
  endTime: string;   // "HH:mm" 24h format (e.g. "21:00")
  days: number[];    // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  notifyOnStartEnd: boolean; // default true
  pausedDate?: string | null; // "yyyy-MM-dd"
}

export type DailyScheduleState = 'active' | 'scheduled' | 'paused' | 'off';

