import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { VocabularyWord } from '../types';

const REMINDERS_KEY = 'my_vocab_reminders_enabled';
const LAST_WORD_KEY = 'my_vocab_last_notified_id';
const INTERVAL_KEY = 'my_vocab_reminder_interval_mins';
const NEXT_TRIGGER_KEY = 'my_vocab_next_reminder_timestamp';
export const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes default

let reminderTimer: ReturnType<typeof setInterval> | null = null;
let nativeListenersInitialized = false;

function getStorageItem(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

/**
 * Checks if running as a native Android or iOS application via Capacitor.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Gets user-configured reminder interval in minutes. Minimum 1 minute.
 */
export function getSavedReminderInterval(): number {
  const saved = getStorageItem(INTERVAL_KEY);
  if (!saved) return 5;
  const parsed = parseInt(saved, 10);
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

/**
 * Saves user-configured reminder interval in minutes.
 */
export function setSavedReminderInterval(mins: number): number {
  const clamped = Math.max(1, Math.floor(mins));
  setStorageItem(INTERVAL_KEY, String(clamped));
  return clamped;
}

/**
 * Gets the timestamp in milliseconds when the next reminder is due.
 */
export function getNextReminderTimestamp(): number | null {
  const saved = getStorageItem(NEXT_TRIGGER_KEY);
  if (!saved) return null;
  const parsed = parseInt(saved, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Sets or clears the target timestamp for the next reminder.
 */
export function setNextReminderTimestamp(timestamp: number | null): void {
  if (timestamp === null) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(NEXT_TRIGGER_KEY);
    }
  } else {
    setStorageItem(NEXT_TRIGGER_KEY, String(timestamp));
  }
}

/**
 * Formats seconds into MM:SS string.
 */
export function formatCountdownSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Checks whether notifications are supported on this platform.
 */
export function isNotificationSupported(): boolean {
  if (Capacitor.isNativePlatform()) {
    return true; // Native Capacitor local notifications are fully supported
  }
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets the current notification permission synchronously (or fallback for web).
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (Capacitor.isNativePlatform()) {
    // In Capacitor, check cached preference or assume default until async check completes
    const cached = getStorageItem('capacitor_notif_granted');
    if (cached === 'true') return 'granted';
    if (cached === 'false') return 'denied';
    return 'default';
  }
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Checks permission status asynchronously on native platform or web.
 */
export async function checkNotificationPermissionAsync(): Promise<NotificationPermission | 'unsupported'> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') {
        setStorageItem('capacitor_notif_granted', 'true');
        return 'granted';
      }
      if (status.display === 'denied') {
        setStorageItem('capacitor_notif_granted', 'false');
        return 'denied';
      }
      return 'default';
    } catch {
      return 'default';
    }
  }

  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests notification permission from user via native Android flow or web dialog.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') {
        setStorageItem('capacitor_notif_granted', 'true');
        return true;
      }
      const requested = await LocalNotifications.requestPermissions();
      const isGranted = requested.display === 'granted';
      setStorageItem('capacitor_notif_granted', isGranted ? 'true' : 'false');
      return isGranted;
    } catch (err) {
      console.warn('[Capacitor] Native permission request exception:', err);
      return false;
    }
  }

  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Failed to request web notification permission:', err);
    return false;
  }
}

/**
 * Initializes native notification interaction listener (when user taps notification).
 */
export function setupNotificationListeners(onOpenQuizForWordId: (wordId: string) => void): void {
  if (Capacitor.isNativePlatform() && !nativeListenersInitialized) {
    nativeListenersInitialized = true;
    try {
      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const wordId = notificationAction.notification.extra?.wordId;
        if (wordId) {
          onOpenQuizForWordId(String(wordId));
        }
      });
    } catch (err) {
      console.warn('[Capacitor] Could not register action listener:', err);
    }
  }
}

/**
 * Reads whether reminders are active from localStorage.
 */
export function isRemindersActive(): boolean {
  return getStorageItem(REMINDERS_KEY) === 'true';
}

/**
 * Sets the active status of reminders in localStorage.
 */
export function setRemindersActive(active: boolean): void {
  setStorageItem(REMINDERS_KEY, active ? 'true' : 'false');
}

/**
 * Picks one word from the list to test.
 * Avoids picking the same word consecutively when 2 or more words exist.
 */
export function pickNextReminderWord(words: VocabularyWord[]): VocabularyWord | null {
  if (!words || words.length === 0) return null;
  if (words.length === 1) return words[0];

  const lastId = getStorageItem(LAST_WORD_KEY);
  const candidates = words.filter((w) => w.id !== lastId);
  const pool = candidates.length > 0 ? candidates : words;

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[randomIndex];
  setStorageItem(LAST_WORD_KEY, selected.id);
  return selected;
}

/**
 * Dispatches a reminder notification for a specific word.
 * Works natively on Android APK via Capacitor or in browser via Web Notifications.
 */
export async function dispatchWordNotification(
  word: VocabularyWord,
  onOpenQuiz?: (word: VocabularyWord) => void
): Promise<boolean> {
  const title = 'Voco — Practice Time!';
  const body = `What does ${word.word.toUpperCase()} mean?`;

  // 1. Native Android Capacitor notification
  if (Capacitor.isNativePlatform()) {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return false;

      const notifId = Math.floor(Math.random() * 900000) + 100000;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            extra: { wordId: word.id },
            schedule: { at: new Date(Date.now() + 250), allowWhileIdle: true },
          },
        ],
      });
      return true;
    } catch (err) {
      console.error('[Capacitor] Failed to schedule native notification:', err);
      return false;
    }
  }

  // 2. Web browser notification
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const url = `/?quiz=${encodeURIComponent(word.id)}`;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: `vocab-reminder-${word.id}`,
          data: { wordId: word.id, url },
        });
        return true;
      }
    }

    const notif = new Notification(title, {
      body,
      icon: '/icon.svg',
      tag: `vocab-reminder-${word.id}`,
    });

    notif.onclick = () => {
      window.focus();
      if (onOpenQuiz) {
        onOpenQuiz(word);
      } else {
        window.location.search = `?quiz=${encodeURIComponent(word.id)}`;
      }
      notif.close();
    };

    return true;
  } catch (err) {
    console.error('Error displaying web notification:', err);
    return false;
  }
}

/**
 * Starts the periodic reminder loop.
 */
export function startRemindersTimer(
  getWords: () => VocabularyWord[],
  onOpenQuiz: (word: VocabularyWord) => void,
  intervalMs: number = DEFAULT_INTERVAL_MS
): boolean {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }

  setRemindersActive(true);

  reminderTimer = setInterval(() => {
    const words = getWords();
    const word = pickNextReminderWord(words);
    if (word) {
      dispatchWordNotification(word, onOpenQuiz);
    }
  }, intervalMs);

  return true;
}

/**
 * Stops the reminder loop and cancels pending native notifications.
 */
export function stopRemindersTimer(): void {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
  setRemindersActive(false);
  setNextReminderTimestamp(null);

  if (Capacitor.isNativePlatform()) {
    LocalNotifications.getPending()
      .then((pending) => {
        if (pending.notifications.length > 0) {
          LocalNotifications.cancel({ notifications: pending.notifications }).catch(() => {});
        }
      })
      .catch(() => {});
  }
}
