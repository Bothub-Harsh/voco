import type { VocabularyWord } from '../types';

const REMINDERS_KEY = 'my_vocab_reminders_enabled';
const LAST_WORD_KEY = 'my_vocab_last_notified_id';
export const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let reminderTimer: ReturnType<typeof setInterval> | null = null;

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
 * Checks whether the browser supports web notifications.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets the current notification permission.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests browser notification permission from the user.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return false;
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
 * Returns null if no words are available.
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
 * Title: "My Vocabulary — Practice Time!"
 * Body: "What does <WORD> mean?"
 * Never reveals the correct answer.
 */
export async function dispatchWordNotification(
  word: VocabularyWord,
  onOpenQuiz?: (word: VocabularyWord) => void
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const title = 'My Vocabulary — Practice Time!';
  const body = `What does ${word.word.toUpperCase()} mean?`;
  const url = `/?quiz=${encodeURIComponent(word.id)}`;

  try {
    // 1. Try via Service Worker if available (better background support)
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

    // 2. Fallback to standard window Notification
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
    console.error('Error displaying notification:', err);
    return false;
  }
}

/**
 * Starts the periodic reminder loop.
 * Triggers every 5 minutes (or custom interval).
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
 * Stops the reminder loop.
 */
export function stopRemindersTimer(): void {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
  setRemindersActive(false);
}

/**
 * Native Android Capacitor bridge stub.
 * When the app is converted to Android using Capacitor, this can delegate to @capacitor/local-notifications.
 */
export async function scheduleNativeCapacitorNotification(
  word: VocabularyWord,
  _scheduledDate: Date
): Promise<void> {
  const isCapacitor = Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })?.Capacitor?.isNativePlatform?.());

  if (isCapacitor) {
    console.log('[Capacitor] Scheduling native Android notification for word:', word.word);
    // When @capacitor/local-notifications is added:
    // import { LocalNotifications } from '@capacitor/local-notifications';
    // await LocalNotifications.schedule({
    //   notifications: [{
    //     title: 'My Vocabulary — Practice Time!',
    //     body: `What does ${word.word.toUpperCase()} mean?`,
    //     id: Math.floor(Math.random() * 100000),
    //     schedule: { at: scheduledDate, allowWhileIdle: true },
    //     extra: { wordId: word.id }
    //   }]
    // });
  }
}
