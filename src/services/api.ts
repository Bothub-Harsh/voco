import { Capacitor } from '@capacitor/core';
import type { BackendStatus, WordQuizPayload } from '../types';

/**
 * Production cloud backend hosting the Groq AI proxy.
 */
export const PRODUCTION_BACKEND_URL = 'https://voco-backend.onrender.com';

/**
 * Determines the correct API Base URL depending on environment:
 * 1. Vite environment variable (VITE_API_URL or VITE_API_BASE_URL) if explicitly set.
 * 2. Capacitor Android / iOS native app: points directly to PRODUCTION_BACKEND_URL.
 * 3. Web in production (non-localhost): points directly to PRODUCTION_BACKEND_URL.
 * 4. Local development in browser (localhost): uses relative path or proxy.
 */
export function getApiBaseUrl(): string {
  // 1. Explicit Vite env variable
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  // 2. Native Capacitor App (Android / iOS): must call cloud backend
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_BACKEND_URL;
  }

  // 3. Web environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Local development web server
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
    // Deployed web frontend (e.g. voco-vbpc.onrender.com) calls production backend
    return PRODUCTION_BACKEND_URL;
  }

  return PRODUCTION_BACKEND_URL;
}

/**
 * Validates a word input before sending to backend.
 */
export function validateInputWord(word: string): string {
  const cleanWord = word.trim();
  if (!cleanWord) {
    throw new Error('Please enter an English word.');
  }
  if (cleanWord.length < 2) {
    throw new Error('Word is too short. Please enter at least 2 letters.');
  }
  if (cleanWord.length > 50) {
    throw new Error('Word is too long. Please enter a single word or short phrase.');
  }
  if (!/[a-zA-Z]/.test(cleanWord)) {
    throw new Error('Please enter a word containing alphabetical characters.');
  }
  return cleanWord;
}

/**
 * Validates incoming AI payload to ensure no malformed JSON fragments or placeholders.
 */
export function validateAiQuizResponse(data: unknown): WordQuizPayload {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response structure received from server.');
  }

  const raw = data as Record<string, unknown>;

  if (typeof raw.word !== 'string' || raw.word.trim().length < 2) {
    throw new Error('Server returned an invalid or missing word.');
  }
  if (typeof raw.meaning !== 'string' || raw.meaning.trim().length < 5) {
    throw new Error('Server returned an incomplete definition.');
  }
  if (typeof raw.example !== 'string' || raw.example.trim().length < 6) {
    throw new Error('Server returned an incomplete example sentence.');
  }
  if (!Array.isArray(raw.options) || raw.options.length !== 4) {
    throw new Error('Server must provide exactly 4 quiz options.');
  }

  for (let i = 0; i < raw.options.length; i++) {
    const opt = raw.options[i];
    if (typeof opt !== 'string' || opt.trim().length < 2) {
      throw new Error(`Quiz option ${i + 1} is empty or incomplete.`);
    }
  }

  const idx = Number(raw.correctIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) {
    throw new Error('Server returned an invalid correct answer index.');
  }

  return {
    word: raw.word.trim(),
    meaning: raw.meaning.trim(),
    example: raw.example.trim(),
    hindiMeaning: typeof raw.hindiMeaning === 'string' && raw.hindiMeaning.trim() ? raw.hindiMeaning.trim() : undefined,
    hindiExample: typeof raw.hindiExample === 'string' && raw.hindiExample.trim() ? raw.hindiExample.trim() : undefined,
    options: raw.options.map((o) => String(o).trim()) as [string, string, string, string],
    correctIndex: idx,
  };
}

/**
 * Checks backend health and Groq API key configuration status.
 */
export async function checkBackendStatus(): Promise<BackendStatus> {
  const base = getApiBaseUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch(`${base}/api/status`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        configured: false,
        model: 'unknown',
        message: `Vocabulary server returned HTTP ${res.status}.`,
        reachable: false,
      };
    }

    const data = await res.json();
    return {
      configured: Boolean(data?.configured),
      model: data?.model || 'unknown',
      message: data?.message || (data?.configured ? 'Groq AI connected.' : 'API key not configured on backend.'),
      reachable: true,
    };
  } catch (err: unknown) {
    const isAbort = err && typeof err === 'object' && 'name' in err && err.name === 'AbortError';
    return {
      configured: false,
      model: 'unknown',
      message: isAbort
        ? 'Backend service is starting up. Please allow a few seconds.'
        : 'Cannot reach vocabulary server. Please check your internet connection.',
      reachable: false,
    };
  }
}

/**
 * Calls backend Groq proxy to generate word definition and quiz options.
 * Includes automatic retry with backoff for transient rate limits (429) or temporary server delays.
 */
export async function generateVocabularyFromAI(word: string): Promise<WordQuizPayload> {
  const cleanWord = validateInputWord(word);
  const base = getApiBaseUrl();

  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${base}/api/vocabulary/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word: cleanWord }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        return validateAiQuizResponse(data);
      }

      if (response.status === 401) {
        throw new Error(
          'Invalid Groq API key configured on the backend server. Please check GROQ_API_KEY in Render dashboard.'
        );
      }

      if (response.status === 503) {
        // Backend says key is missing or service starting
        const msg = data?.error || 'AI service temporarily unavailable.';
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw new Error(msg);
      }

      if (response.status === 429) {
        if (attempt < maxAttempts) {
          // Exponential backoff for rate limits
          await new Promise((r) => setTimeout(r, 1800 * attempt));
          continue;
        }
        throw new Error('AI rate limit reached. Please wait a few moments and retry.');
      }

      const message = data?.error || `Request failed with HTTP ${response.status}`;
      const details = data?.details ? ` (${data.details})` : '';
      throw new Error(`${message}${details}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry on configuration/auth errors
      if (lastError.message.includes('Invalid Groq API key') || lastError.message.includes('Please enter')) {
        throw lastError;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }

  throw lastError || new Error(`Unable to generate definition for "${cleanWord}". Please check connection.`);
}

/**
 * Calls backend Groq proxy to refresh an existing word's definition and example sentence
 * with alternative wording.
 */
export async function refreshVocabularyFromAI(
  word: string,
  currentMeaning?: string,
  currentExample?: string
): Promise<WordQuizPayload> {
  const cleanWord = validateInputWord(word);
  const base = getApiBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${base}/api/vocabulary/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        word: cleanWord,
        currentMeaning,
        currentExample,
        isRefresh: true,
      }),
    });

    // Fallback to /api/vocabulary/generate with isRefresh flag if /api/vocabulary/refresh is not available
    if (response.status === 404) {
      response = await fetch(`${base}/api/vocabulary/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: cleanWord,
          currentMeaning,
          currentExample,
          isRefresh: true,
        }),
      });
    }
  } catch (err) {
    throw new Error(
      'Unable to connect to vocabulary server. Please verify your internet connection.'
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 503) {
      throw new Error(
        'Groq AI key is not configured on the Render backend server. Please set GROQ_API_KEY in Render dashboard environment variables.'
      );
    }
    if (response.status === 401) {
      throw new Error(
        'Invalid Groq API key configured on the backend server. Please check GROQ_API_KEY in Render dashboard.'
      );
    }
    if (response.status === 429) {
      throw new Error(
        'Groq AI rate limit reached. Please wait a few moments and click Retry.'
      );
    }
    const message = data?.error || `Request failed with HTTP ${response.status}`;
    const details = data?.details ? ` (${data.details})` : '';
    throw new Error(`${message}${details}`);
  }

  return validateAiQuizResponse(data);
}

/**
 * Calls backend Groq proxy to generate intelligent, balanced distractors for a quiz question.
 * Returns null if backend is unreachable or unconfigured (caller falls back to smart local engine).
 */
export async function generateQuizDistractorsFromAI(
  word: string,
  meaning: string
): Promise<{ options: [string, string, string, string]; correctIndex: number } | null> {
  const base = getApiBaseUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${base}/api/quiz/generate-distractors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: word.trim(), meaning: meaning.trim() }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (
      data &&
      Array.isArray(data.options) &&
      data.options.length === 4 &&
      Number.isInteger(data.correctIndex) &&
      data.correctIndex >= 0 &&
      data.correctIndex <= 3
    ) {
      return {
        options: data.options.map((o: unknown) => String(o).trim()) as [string, string, string, string],
        correctIndex: data.correctIndex,
      };
    }
    return null;
  } catch {
    return null;
  }
}
