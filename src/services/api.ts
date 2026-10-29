import type { BackendStatus, WordQuizPayload } from '../types';

/**
 * Checks backend health and Groq API key configuration status.
 */
export async function checkBackendStatus(): Promise<BackendStatus> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) {
      return {
        configured: false,
        model: 'unknown',
        message: `Backend proxy returned status ${res.status}`,
      };
    }
    return await res.json();
  } catch (err) {
    return {
      configured: false,
      model: 'unknown',
      message: 'Cannot reach backend proxy. Ensure "npm run server" is running.',
    };
  }
}

/**
 * Calls backend Groq proxy to generate word definition and quiz options.
 */
export async function generateVocabularyFromAI(word: string): Promise<WordQuizPayload> {
  const cleanWord = word.trim();
  if (!cleanWord) {
    throw new Error('Please enter a word.');
  }

  let response: Response;
  try {
    response = await fetch('/api/vocabulary/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word: cleanWord }),
    });
  } catch (err) {
    throw new Error(
      'Unable to connect to backend proxy. Please verify your internet connection and that the backend server is running.'
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || `Request failed with status ${response.status}`;
    const details = data?.details ? ` (${data.details})` : '';
    throw new Error(`${message}${details}`);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response received from server.');
  }

  // Client-side schema verification for safety
  if (
    typeof data.word !== 'string' ||
    typeof data.meaning !== 'string' ||
    typeof data.example !== 'string' ||
    !Array.isArray(data.options) ||
    data.options.length !== 4 ||
    typeof data.correctIndex !== 'number'
  ) {
    throw new Error('Server returned malformed quiz structure.');
  }

  return {
    word: data.word,
    meaning: data.meaning,
    example: data.example,
    options: data.options as [string, string, string, string],
    correctIndex: data.correctIndex,
  };
}

