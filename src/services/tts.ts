/**
 * Unified Text-to-Speech service for Voco.
 *
 * On Android (native): delegates to the VocoNotificationScheduler Capacitor plugin
 * which uses Android's built-in android.speech.tts.TextToSpeech engine (offline).
 *
 * On web / fallback: uses window.speechSynthesis API.
 *
 * Always stops any ongoing speech before starting a new utterance.
 */

import { Capacitor } from '@capacitor/core';
import { VocoScheduler } from './notifications';

let webSpeakingTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Stop any currently playing speech (native or web).
 */
export async function stopSpeech(): Promise<void> {
  if (webSpeakingTimeoutId !== null) {
    clearTimeout(webSpeakingTimeoutId);
    webSpeakingTimeoutId = null;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      // stopSpeech plugin method — fire and forget
      await (VocoScheduler as unknown as { stopSpeech: () => Promise<void> }).stopSpeech();
    } catch {
      // Plugin method may not exist on older builds; ignore
    }
  } else {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

/**
 * Speak the given English word using the best available TTS engine.
 * Automatically stops any previous speech first.
 *
 * @param word The word to pronounce (English)
 * @returns Promise that resolves when speech has been dispatched
 */
export async function speak(word: string): Promise<void> {
  if (!word || !word.trim()) return;
  const cleanWord = word.trim();

  // Always stop previous speech first to prevent overlapping
  await stopSpeech();

  if (Capacitor.isNativePlatform()) {
    try {
      await (VocoScheduler as unknown as { speak: (opts: { text: string; lang: string }) => Promise<void> }).speak({
        text: cleanWord,
        lang: 'en-IN',
      });
    } catch {
      // Fallback: try web speech if plugin method unavailable
      _webSpeak(cleanWord);
    }
  } else {
    _webSpeak(cleanWord);
  }
}

/**
 * Internal: use Web Speech API to pronounce a word.
 */
function _webSpeak(word: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-IN';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;

  // Try to pick an English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => v.lang === 'en-IN')
    || voices.find((v) => v.lang === 'en-US')
    || voices.find((v) => v.lang.startsWith('en'));
  if (preferred) {
    utterance.voice = preferred;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Returns true if TTS is available on the current platform.
 */
export function isTtsAvailable(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

