import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { VocabularyWord } from '../types';

// ─────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────
const REMINDERS_KEY = 'my_vocab_reminders_enabled';
const LAST_WORD_KEY = 'my_vocab_last_notified_id';
const INTERVAL_KEY = 'my_vocab_reminder_interval_mins';
const NEXT_TRIGGER_KEY = 'my_vocab_next_reminder_timestamp';
const SCHEDULED_IDS_KEY = 'voco_scheduled_notif_ids';

// Default interval in milliseconds (5 minutes)
export const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

// Native notification ID base — range 100000–199999 reserved for Voco reminders
const NOTIF_ID_BASE = 100000;
const NOTIF_ID_RANGE = 100000;

// Maximum number of future notifications to pre-schedule
const MAX_SCHEDULED_NOTIFICATIONS = 20;

let nativeListenersInitialized = false;

// ─────────────────────────────────────────────
// LocalStorage helpers
// ─────────────────────────────────────────────
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

function removeStorageItem(key: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}

// ─────────────────────────────────────────────
// Platform detection
// ─────────────────────────────────────────────

/**
 * Returns true when running as a native Android/iOS Capacitor app.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

// ─────────────────────────────────────────────
// Interval & timestamp persistence
// ─────────────────────────────────────────────

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
 * Gets the timestamp (ms) when the next reminder is due.
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
    removeStorageItem(NEXT_TRIGGER_KEY);
  } else {
    setStorageItem(NEXT_TRIGGER_KEY, String(timestamp));
  }
}

// ─────────────────────────────────────────────
// Countdown formatting
// ─────────────────────────────────────────────

/**
 * Formats a total second count as MM:SS.
 */
export function formatCountdownSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Permission helpers
// ─────────────────────────────────────────────

/**
 * Returns true when notifications are supported on this platform.
 */
export function isNotificationSupported(): boolean {
  if (Capacitor.isNativePlatform()) {
    return true; // Always supported natively
  }
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Returns the cached notification permission status (synchronous).
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (Capacitor.isNativePlatform()) {
    const cached = getStorageItem('capacitor_notif_granted');
    if (cached === 'true') return 'granted';
    if (cached === 'false') return 'denied';
    return 'default';
  }
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Checks the real permission status asynchronously.
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
 * Requests notification permission — native Android dialog or web dialog.
 * Returns true if permission is granted.
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

// ─────────────────────────────────────────────
// Active reminders state
// ─────────────────────────────────────────────

/**
 * Returns true when reminders are currently active (persisted).
 */
export function isRemindersActive(): boolean {
  return getStorageItem(REMINDERS_KEY) === 'true';
}

/**
 * Persists reminder active state.
 */
export function setRemindersActive(active: boolean): void {
  setStorageItem(REMINDERS_KEY, active ? 'true' : 'false');
}

// ─────────────────────────────────────────────
// Word picker
// ─────────────────────────────────────────────

/**
 * Picks one word for the reminder notification.
 * Avoids repeating the last word when there are 2+ words.
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

// ─────────────────────────────────────────────
// Scheduled notification ID store
// ─────────────────────────────────────────────

function saveScheduledIds(ids: number[]): void {
  setStorageItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
}

function loadScheduledIds(): number[] {
  const raw = getStorageItem(SCHEDULED_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// Core: Native pre-scheduling
// ─────────────────────────────────────────────

/**
 * Schedules up to `count` future notifications at `intervalMinutes` intervals.
 * Words are cycled round-robin. The notification payload is baked in at scheduling
 * time so no JS runtime is needed when the notification fires.
 *
 * Existing Voco notifications are cancelled before scheduling new ones.
 */
export async function scheduleNativeReminders(
  words: VocabularyWord[],
  intervalMinutes: number,
  count: number = MAX_SCHEDULED_NOTIFICATIONS
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!words || words.length === 0) return false;

  try {
    // 1. Cancel any previously scheduled Voco notifications
    await cancelAllNativeReminders();

    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
    const notifications: {
      id: number;
      title: string;
      body: string;
      extra: { wordId: string };
      schedule: { at: Date; allowWhileIdle: boolean };
      smallIcon?: string;
    }[] = [];

    const ids: number[] = [];
    const now = Date.now();

    // Build the notification list, cycling through words round-robin
    // Start with a fresh index that doesn't repeat the last notified word
    const lastId = getStorageItem(LAST_WORD_KEY);
    const startCandidates = words.filter((w) => w.id !== lastId);
    const startPool = startCandidates.length > 0 ? startCandidates : words;
    let wordIndex = Math.floor(Math.random() * startPool.length);
    // Resolve to global words array index
    const firstWord = startPool[wordIndex];
    let globalIndex = words.findIndex((w) => w.id === firstWord.id);
    if (globalIndex < 0) globalIndex = 0;

    for (let i = 0; i < count; i++) {
      const word = words[globalIndex % words.length];
      const fireAt = new Date(now + (i + 1) * intervalMs);
      const notifId = NOTIF_ID_BASE + (i % NOTIF_ID_RANGE);

      notifications.push({
        id: notifId,
        title: 'Voco — Practice Time! 📚',
        body: `What does ${word.word.toUpperCase()} mean?`,
        extra: { wordId: word.id },
        schedule: { at: fireAt, allowWhileIdle: true },
        smallIcon: 'ic_stat_icon_config_sample',
      });
      ids.push(notifId);
      globalIndex++;
    }

    // Store the first notification's timestamp so the UI countdown can show it
    const firstFireAt = now + intervalMs;
    setNextReminderTimestamp(firstFireAt);

    // Update last word to the first notification's word
    if (notifications.length > 0) {
      setStorageItem(LAST_WORD_KEY, notifications[0].extra.wordId);
    }

    // Schedule all at once
    await LocalNotifications.schedule({ notifications });
    saveScheduledIds(ids);

    console.log(`[Voco] Scheduled ${notifications.length} native notifications at ${intervalMinutes}-min intervals.`);
    return true;
  } catch (err) {
    console.error('[Voco] Failed to schedule native reminders:', err);
    return false;
  }
}

/**
 * Cancels all previously scheduled Voco reminder notifications.
 */
export async function cancelAllNativeReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Cancel using stored IDs first
    const storedIds = loadScheduledIds();
    if (storedIds.length > 0) {
      await LocalNotifications.cancel({
        notifications: storedIds.map((id) => ({ id })),
      }).catch(() => {});
    }

    // Also cancel anything pending in the full NOTIF_ID_BASE range as a safety net
    const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
    const vocoPending = pending.notifications.filter(
      (n) => n.id >= NOTIF_ID_BASE && n.id < NOTIF_ID_BASE + NOTIF_ID_RANGE
    );
    if (vocoPending.length > 0) {
      await LocalNotifications.cancel({
        notifications: vocoPending.map((n) => ({ id: n.id })),
      }).catch(() => {});
    }

    saveScheduledIds([]);
    setNextReminderTimestamp(null);
  } catch (err) {
    console.warn('[Voco] cancelAllNativeReminders error:', err);
  }
}

/**
 * Returns the number of currently pending Voco notifications.
 * Useful to decide whether rescheduling is needed on app open.
 */
export async function getPendingNativeReminderCount(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  try {
    const pending = await LocalNotifications.getPending();
    return pending.notifications.filter(
      (n) => n.id >= NOTIF_ID_BASE && n.id < NOTIF_ID_BASE + NOTIF_ID_RANGE
    ).length;
  } catch {
    return 0;
  }
}

/**
 * Schedules a single test notification 3 seconds from now (native only).
 */
export async function scheduleTestNotification(word: VocabularyWord): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const testId = NOTIF_ID_BASE - 1; // Use ID just below the range for test
    // Cancel any previous test notification
    await LocalNotifications.cancel({ notifications: [{ id: testId }] }).catch(() => {});

    await LocalNotifications.schedule({
      notifications: [
        {
          id: testId,
          title: 'Voco — Test Reminder 📚',
          body: `What does ${word.word.toUpperCase()} mean?`,
          extra: { wordId: word.id },
          schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
          smallIcon: 'ic_stat_icon_config_sample',
        },
      ],
    });
    return true;
  } catch (err) {
    console.error('[Voco] scheduleTestNotification error:', err);
    return false;
  }
}

// ─────────────────────────────────────────────
// Web browser notification (fallback)
// ─────────────────────────────────────────────

/**
 * Dispatches a notification immediately — used for web browser fallback
 * and as a fire-and-forget from the JS timer on web.
 */
export async function dispatchWordNotification(
  word: VocabularyWord,
  onOpenQuiz?: (word: VocabularyWord) => void
): Promise<boolean> {
  const title = 'Voco — Practice Time!';
  const body = `What does ${word.word.toUpperCase()} mean?`;

  // Native: schedule 250ms in the future (immediate-ish)
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
      console.error('[Capacitor] Failed to dispatch native notification:', err);
      return false;
    }
  }

  // Web browser notification
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

// ─────────────────────────────────────────────
// Notification tap listener
// ─────────────────────────────────────────────

/**
 * Registers a listener for when the user taps a Voco notification.
 * Calls onOpenQuizForWordId with the word's ID.
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

      // When a notification is received while app is in foreground, reschedule if running low
      LocalNotifications.addListener('localNotificationReceived', () => {
        // Rescheduling on foreground receipt is handled by App.tsx via getPendingNativeReminderCount
      });
    } catch (err) {
      console.warn('[Capacitor] Could not register notification listeners:', err);
    }
  }
}

// ─────────────────────────────────────────────
// Legacy JS timer (web-only fallback)
// Kept for browser web version compatibility.
// NOT used on Android APK.
// ─────────────────────────────────────────────

let _webReminderTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Starts a JS-based reminder timer for the web browser version.
 * This is intentionally NOT used on native Android — use scheduleNativeReminders() instead.
 */
export function startWebReminderTimer(
  getWords: () => VocabularyWord[],
  onOpenQuiz: (word: VocabularyWord) => void,
  intervalMs: number = DEFAULT_INTERVAL_MS
): void {
  if (_webReminderTimer) {
    clearInterval(_webReminderTimer);
    _webReminderTimer = null;
  }

  _webReminderTimer = setInterval(() => {
    const words = getWords();
    const word = pickNextReminderWord(words);
    if (word) {
      dispatchWordNotification(word, onOpenQuiz);
    }
  }, intervalMs);
}

/**
 * Stops the JS-based web reminder timer.
 */
export function stopWebReminderTimer(): void {
  if (_webReminderTimer) {
    clearInterval(_webReminderTimer);
    _webReminderTimer = null;
  }
}
