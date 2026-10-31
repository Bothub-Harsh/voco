import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { VocabularyWord } from '../types';

// ─────────────────────────────────────────────
// Native Android Plugin Bridge Interface
// ─────────────────────────────────────────────
interface VocoSchedulerPlugin {
  startReminders(options: { intervalMinutes: number; words: string }): Promise<{
    success: boolean;
    nextTrigger: number;
    generation?: number;
    exactAlarmGranted: boolean;
  }>;
  stopReminders(): Promise<{ success: boolean }>;
  updateWords(options: { words: string }): Promise<{ success: boolean }>;
  sendTestNotification(options: {
    wordId: string;
    word: string;
    meaning?: string;
    example?: string;
    options?: string;
    correctIndex?: number;
  }): Promise<{ success: boolean }>;
  getReminderStatus(): Promise<{
    active: boolean;
    intervalMinutes: number;
    nextTrigger: number;
    generation?: number;
    exactAlarmGranted: boolean;
  }>;
  getQuizStats(): Promise<{
    totalAnswered: number;
    correctAnswered: number;
    lastWord: string;
    lastCorrect: boolean;
    lastTime: number;
  }>;
  checkExactAlarmPermission(): Promise<{ exact_alarm_granted: boolean }>;
  openExactAlarmSettings(): Promise<{ opened: boolean }>;
  openBatterySettings(): Promise<{ opened: boolean }>;
  openAppSettings(): Promise<{ opened: boolean }>;
  // TTS
  speak(options: { text: string; lang?: string }): Promise<{ success: boolean }>;
  stopSpeech(): Promise<{ success: boolean }>;
  // Native file export
  exportBackup(options: { fileName: string; content: string }): Promise<{
    success: boolean;
    filePath?: string;
    message?: string;
    error?: string;
  }>;
}

export const VocoScheduler = registerPlugin<VocoSchedulerPlugin>('VocoNotificationScheduler');

// ─────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────
const REMINDERS_KEY = 'my_vocab_reminders_enabled';
const LAST_WORD_KEY = 'my_vocab_last_notified_id';
const INTERVAL_KEY = 'my_vocab_reminder_interval_mins';
const NEXT_TRIGGER_KEY = 'my_vocab_next_reminder_timestamp';

// Default interval in milliseconds (5 minutes)
export const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export const REMINDER_CHANNEL_ID = 'voco_reminders';

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
 * Returns true when running as a native Android or iOS application.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
}

// ─────────────────────────────────────────────
// Channel management
// ─────────────────────────────────────────────

export async function ensureNotificationChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'Voco Practice Reminders',
      description: 'Scheduled practice prompts for saved vocabulary words',
      importance: 4, // NotificationManager.IMPORTANCE_HIGH
      visibility: 1, // NotificationCompat.VISIBILITY_PUBLIC
      vibration: true,
      lights: true,
      lightColor: '#4F46E5',
    });
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
    const res = await VocoScheduler.checkExactAlarmPermission();
    return res?.exact_alarm_granted ? 'granted' : 'prompt';
  } catch {
    return 'unsupported';
  }
}

/**
 * Opens Android system settings for Alarms & Reminders.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await VocoScheduler.openExactAlarmSettings();
  } catch (err) {
    console.warn('[Voco] Could not open alarm settings:', err);
  }
}

/**
 * Opens Android battery optimization / app details settings.
 */
export async function openBatterySettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await VocoScheduler.openBatterySettings();
  } catch (err) {
    console.warn('[Voco] Could not open battery settings:', err);
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
// Core: Native Android Alarm Scheduling
// ─────────────────────────────────────────────

/**
 * Starts native Android alarm reminders.
 * The Android operating system's AlarmManager handles subsequent reminders perpetually.
 */
export async function scheduleNativeReminders(
  words: VocabularyWord[],
  intervalMinutes: number
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (!words || words.length === 0) return false;

  try {
    await ensureNotificationChannel();

    const wordsData = JSON.stringify(
      words.map((w) => ({
        id: w.id,
        word: w.word,
        meaning: w.meaning,
        example: w.example || '',
        options: w.options || [],
        correctIndex: typeof w.correctIndex === 'number' ? w.correctIndex : 0,
      }))
    );

    const result = await VocoScheduler.startReminders({
      intervalMinutes,
      words: wordsData,
    });

    if (result && result.nextTrigger) {
      setNextReminderTimestamp(result.nextTrigger);
    } else {
      setNextReminderTimestamp(Date.now() + intervalMinutes * 60 * 1000);
    }

    setRemindersActive(true);
    console.log(`[Voco] Native AlarmManager reminders active every ${intervalMinutes} minutes.`);
    return true;
  } catch (err) {
    console.error('[Voco] Failed to start native reminders:', err);
    return false;
  }
}

/**
 * Updates the native Android persisted word bank so subsequent reminders rotate new words.
 */
export async function syncWordsWithNativeScheduler(words: VocabularyWord[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || words.length === 0) return;
  try {
    const wordsData = JSON.stringify(
      words.map((w) => ({
        id: w.id,
        word: w.word,
        meaning: w.meaning,
        example: w.example || '',
        options: w.options || [],
        correctIndex: typeof w.correctIndex === 'number' ? w.correctIndex : 0,
      }))
    );
    await VocoScheduler.updateWords({ words: wordsData });
  } catch (err) {
    console.warn('[Voco] syncWordsWithNativeScheduler note:', err);
  }
}

/**
 * Stops all reminders in Android AlarmManager and clears pending alarms.
 */
export async function cancelAllNativeReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await VocoScheduler.stopReminders();
    setRemindersActive(false);
    setNextReminderTimestamp(null);
  } catch (err) {
    console.warn('[Voco] cancelAllNativeReminders error:', err);
  }
}

/**
 * Checks native Android reminder status.
 */
export async function getNativeReminderStatus(): Promise<{
  active: boolean;
  intervalMinutes: number;
  nextTrigger: number;
  generation?: number;
  exactAlarmGranted: boolean;
} | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await VocoScheduler.getReminderStatus();
  } catch {
    return null;
  }
}

/**
 * Immediately delivers one test notification through Android native NotificationManager
 * configured to launch the fast native quiz popup when tapped.
 */
export async function scheduleTestNotification(word: VocabularyWord): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await ensureNotificationChannel();
    await VocoScheduler.sendTestNotification({
      wordId: word.id,
      word: word.word,
      meaning: word.meaning,
      example: word.example || '',
      options: JSON.stringify(word.options || []),
      correctIndex: typeof word.correctIndex === 'number' ? word.correctIndex : 0,
    });
    return true;
  } catch (err) {
    console.error('[Voco] scheduleTestNotification error:', err);
    return false;
  }
}

/**
 * Retrieves aggregate quiz statistics recorded by the native popup window.
 */
export async function getNativeQuizStats(): Promise<{
  totalAnswered: number;
  correctAnswered: number;
  lastWord: string;
  lastCorrect: boolean;
  lastTime: number;
} | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await VocoScheduler.getQuizStats();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Web browser notification (fallback for web only)
// ─────────────────────────────────────────────

export async function dispatchWordNotification(
  word: VocabularyWord,
  onOpenQuiz?: (word: VocabularyWord) => void
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    return scheduleTestNotification(word);
  }

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const title = 'Voco — Practice Time!';
  const body = `What does ${word.word.toUpperCase()} mean?`;
  const url = `/?quiz=${encodeURIComponent(word.id)}`;

  try {
    // Use a unique timestamp-based tag so each reminder creates a NEW notification
    // instead of replacing the previous one (same tag = replacement in browser notifications)
    const uniqueTag = `vocab-reminder-${word.id}-${Date.now()}`;

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: uniqueTag,
          data: { wordId: word.id, url },
        });
        return true;
      }
    }

    const notif = new Notification(title, {
      body,
      icon: '/icon.svg',
      tag: uniqueTag,
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
      (VocoScheduler as any).addListener('notificationOpened', (data: { wordId: string }) => {
        if (data && data.wordId) {
          onOpenQuizForWordId(String(data.wordId));
        }
      });
    } catch (err) {
      console.warn('[Voco] Native notification listener note:', err);
    }
  }
}
