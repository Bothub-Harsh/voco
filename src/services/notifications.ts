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

// High-importance notification channel ID for Android 8.0+
export const REMINDER_CHANNEL_ID = 'voco_reminders';

// Notification ID ranges
const NOTIF_ID_BASE = 100000;
const NOTIF_ID_RANGE = 100000;
const TEST_NOTIF_ID = 99999;

// Maximum future slots to pre-schedule with Android AlarmManager
// 50 slots at 5 min = 250 minutes (over 4 hours of continuous reminders without opening app)
const MAX_SCHEDULED_NOTIFICATIONS = 50;

let nativeListenersInitialized = false;
let channelInitialized = false;

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
 * Returns true when running as a native Android or iOS Capacitor app.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
}

// ─────────────────────────────────────────────
// Channel management (Android 8.0+)
// ─────────────────────────────────────────────

/**
 * Ensures the high-priority "voco_reminders" notification channel exists on Android.
 * Sets IMPORTANCE_HIGH (4) and lockscreen VISIBILITY_PUBLIC (1) with vibration enabled
 * so reminders show heads-up banners, sound, and show on the lock screen even when app is killed.
 */
export async function ensureNotificationChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform() || channelInitialized) return;

  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'Voco Practice Reminders',
      description: 'Scheduled reminders to practice your saved vocabulary words',
      importance: 4, // Android NotificationManager.IMPORTANCE_HIGH (heads-up banner + sound + vibration)
      visibility: 1, // NotificationCompat.VISIBILITY_PUBLIC (full content on lock screen)
      vibration: true,
      lights: true,
      lightColor: '#4F46E5',
    });
    channelInitialized = true;
  } catch (err) {
    console.warn('[Voco] Channel setup note:', err);
  }
}

// ─────────────────────────────────────────────
// Interval & timestamp persistence
// ─────────────────────────────────────────────

export function getSavedReminderInterval(): number {
  const saved = getStorageItem(INTERVAL_KEY);
  if (!saved) return 5;
  const parsed = parseInt(saved, 10);
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

export function setSavedReminderInterval(mins: number): number {
  const clamped = Math.max(1, Math.floor(mins));
  setStorageItem(INTERVAL_KEY, String(clamped));
  return clamped;
}

export function getNextReminderTimestamp(): number | null {
  const saved = getStorageItem(NEXT_TRIGGER_KEY);
  if (!saved) return null;
  const parsed = parseInt(saved, 10);
  return isNaN(parsed) ? null : parsed;
}

export function setNextReminderTimestamp(timestamp: number | null): void {
  if (timestamp === null) {
    removeStorageItem(NEXT_TRIGGER_KEY);
  } else {
    setStorageItem(NEXT_TRIGGER_KEY, String(timestamp));
  }
}

export function formatCountdownSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Permission helpers
// ─────────────────────────────────────────────

export function isNotificationSupported(): boolean {
  if (Capacitor.isNativePlatform()) {
    return true;
  }
  return typeof window !== 'undefined' && 'Notification' in window;
}

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

export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureNotificationChannel();

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
 * Checks if exact alarm scheduling is granted on Android 12+.
 */
export async function checkExactAlarmPermission(): Promise<'granted' | 'prompt' | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const res = await (LocalNotifications as any).checkExactNotificationSetting();
    return res?.exact_alarm === 'granted' ? 'granted' : 'prompt';
  } catch {
    return 'unsupported';
  }
}

/**
 * Opens Android system settings for Alarms & Reminders if user needs to allow exact alarms.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await (LocalNotifications as any).changeExactNotificationSetting();
  } catch (err) {
    console.warn('[Voco] Could not open alarm settings:', err);
  }
}

// ─────────────────────────────────────────────
// Active reminders state
// ─────────────────────────────────────────────

export function isRemindersActive(): boolean {
  return getStorageItem(REMINDERS_KEY) === 'true';
}

export function setRemindersActive(active: boolean): void {
  setStorageItem(REMINDERS_KEY, active ? 'true' : 'false');
}

// ─────────────────────────────────────────────
// Word picker
// ─────────────────────────────────────────────

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
 * Pre-schedules up to `count` future reminder alarms directly with Android's native AlarmManager.
 * Features:
 * 1. Dedicated high-importance channel ("voco_reminders") for heads-up display and lock-screen visibility.
 * 2. Proper monochrome vector icon ("ic_stat_voco") for clean status bar rendering.
 * 3. allowWhileIdle: true to fire during Doze mode and screen-off.
 * 4. foreground: true to raise priority to PRIORITY_HIGH for heads-up pop-down banner.
 * 5. Bakes distinct vocabulary words into each slot round-robin so each notification is unique.
 */
export async function scheduleNativeReminders(
  words: VocabularyWord[],
  intervalMinutes: number,
  count: number = MAX_SCHEDULED_NOTIFICATIONS
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!words || words.length === 0) return false;

  try {
    // Ensure high-priority channel exists before scheduling
    await ensureNotificationChannel();

    // Clean up any previously scheduled alarms first to prevent duplicates
    await cancelAllNativeReminders();

    // Check if exact alarms are allowed
    let canExact = true;
    try {
      const exactStatus = await checkExactAlarmPermission();
      canExact = exactStatus === 'granted' || exactStatus === 'unsupported';
    } catch {
      canExact = false;
    }

    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
    const notifications: any[] = [];
    const ids: number[] = [];
    const now = Date.now();

    // Pick starting word
    const lastId = getStorageItem(LAST_WORD_KEY);
    const startCandidates = words.filter((w) => w.id !== lastId);
    const startPool = startCandidates.length > 0 ? startCandidates : words;
    let wordIndex = Math.floor(Math.random() * startPool.length);
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
        channelId: REMINDER_CHANNEL_ID,
        smallIcon: 'ic_stat_voco',
        iconColor: '#4F46E5',
        foreground: true, // Elevates to PRIORITY_HIGH on Android for heads-up display
        schedule: {
          at: fireAt,
          allowWhileIdle: true,
        },
        isExactNotification: canExact,
        isExactMandatory: false,
      });
      ids.push(notifId);
      globalIndex++;
    }

    // Set first trigger timestamp for visual countdown
    const firstFireAt = now + intervalMs;
    setNextReminderTimestamp(firstFireAt);

    if (notifications.length > 0) {
      setStorageItem(LAST_WORD_KEY, notifications[0].extra.wordId);
    }

    // Register all alarms with Android AlarmManager in one native batch call
    await LocalNotifications.schedule({ notifications });
    saveScheduledIds(ids);

    console.log(`[Voco] Scheduled ${notifications.length} native background reminders (${intervalMinutes}m interval).`);
    return true;
  } catch (err) {
    console.error('[Voco] Failed to schedule native reminders:', err);
    return false;
  }
}

/**
 * Cancels all scheduled reminder notifications in Android AlarmManager and storage.
 * Completely clears all pending alarms so reminders do not restart after reboot or reopening.
 */
export async function cancelAllNativeReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Cancel by stored ID list
    const storedIds = loadScheduledIds();
    if (storedIds.length > 0) {
      await LocalNotifications.cancel({
        notifications: storedIds.map((id) => ({ id })),
      }).catch(() => {});
    }

    // 2. Also call native cancelAll() to purge any orphaned alarms in AlarmManager
    if (typeof (LocalNotifications as any).cancelAll === 'function') {
      await (LocalNotifications as any).cancelAll().catch(() => {});
    }

    saveScheduledIds([]);
    setNextReminderTimestamp(null);
  } catch (err) {
    console.warn('[Voco] cancelAllNativeReminders error:', err);
  }
}

/**
 * Returns count of pending scheduled reminders.
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
 * Dispatches an immediate test notification using native AlarmManager (fires in ~1.5s).
 * Displays full notification with sound, vibration, and heads-up banner.
 */
export async function scheduleTestNotification(word: VocabularyWord): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await ensureNotificationChannel();

    // Cancel any previous test notification
    await LocalNotifications.cancel({ notifications: [{ id: TEST_NOTIF_ID }] }).catch(() => {});

    // Check exact alarm support
    let canExact = true;
    try {
      const exactStatus = await checkExactAlarmPermission();
      canExact = exactStatus === 'granted' || exactStatus === 'unsupported';
    } catch {
      canExact = false;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: TEST_NOTIF_ID,
          title: 'Voco — Test Reminder 📚',
          body: `What does ${word.word.toUpperCase()} mean?`,
          extra: { wordId: word.id },
          channelId: REMINDER_CHANNEL_ID,
          smallIcon: 'ic_stat_voco',
          iconColor: '#4F46E5',
          foreground: true,
          schedule: {
            at: new Date(Date.now() + 1500),
            allowWhileIdle: true,
          },
          isExactNotification: canExact,
          isExactMandatory: false,
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
// Web browser notification (fallback for web only)
// ─────────────────────────────────────────────

export async function dispatchWordNotification(
  word: VocabularyWord,
  onOpenQuiz?: (word: VocabularyWord) => void
): Promise<boolean> {
  const title = 'Voco — Practice Time!';
  const body = `What does ${word.word.toUpperCase()} mean?`;

  // Native: dispatch via LocalNotifications
  if (Capacitor.isNativePlatform()) {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return false;

      await ensureNotificationChannel();
      const notifId = Math.floor(Math.random() * 900000) + 100000;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            extra: { wordId: word.id },
            channelId: REMINDER_CHANNEL_ID,
            smallIcon: 'ic_stat_voco',
            iconColor: '#4F46E5',
            foreground: true,
            schedule: { at: new Date(Date.now() + 250), allowWhileIdle: true },
            isExactNotification: false,
            isExactMandatory: false,
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
      console.warn('[Capacitor] Could not register notification listeners:', err);
    }
  }
}
