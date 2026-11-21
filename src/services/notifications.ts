import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { VocabularyWord, DailyScheduleConfig, DailyScheduleState } from '../types';

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
    hindiMeaning?: string;
    hindiExample?: string;
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
  // Daily Schedule
  saveDailySchedule(options: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    days: string;
    notifyOnStartEnd: boolean;
  }): Promise<{
    success: boolean;
    enabled: boolean;
    isInsideWindow: boolean;
    isPausedToday: boolean;
  }>;
  getDailySchedule(): Promise<{
    enabled: boolean;
    startTime: string;
    endTime: string;
    days: string;
    notifyOnStartEnd: boolean;
    isInsideWindow: boolean;
    isPausedToday: boolean;
    remindersRunning: boolean;
  }>;
  cancelDailySchedule(): Promise<{ success: boolean }>;
  // Theme sync
  saveTheme(options: { themeId: string }): Promise<{ success: boolean; themeId?: string }>;
  getSavedTheme(): Promise<{ themeId: string }>;
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
const PENDING_NOTIFICATION_QUEUE_KEY = 'voco_pending_notifications_queue';

export interface PendingNotificationItem {
  notificationId?: number;
  wordId: string;
  word: string;
  timestamp: number;
  isTest?: boolean;
}

// Default interval in milliseconds (5 minutes)
export const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export const REMINDER_CHANNEL_ID = 'voco_reminders';

let nativeListenersInitialized = false;

// ─────────────────────────────────────────────
// LocalStorage helpers & Pending Notification Queue
// ─────────────────────────────────────────────
const memStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback to memStore
  }
  return memStore.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(key, value);
    }
  } catch {
    // fallback to memStore
  }
  memStore.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
      localStorage.removeItem(key);
    }
  } catch {
    // fallback to memStore
  }
  memStore.delete(key);
}

export function getPendingNotificationQueue(): PendingNotificationItem[] {
  const data = getStorageItem(PENDING_NOTIFICATION_QUEUE_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
    // Prune stale or expired notifications (older than 24 hours in real epoch ms)
    const valid = parsed.filter((item) => {
      if (!item || !item.wordId) return false;
      if (typeof item.timestamp === 'number' && item.timestamp > 1_000_000_000_000) {
        return now - item.timestamp < maxAgeMs;
      }
      return true;
    });
    if (valid.length !== parsed.length) {
      savePendingNotificationQueue(valid);
    }
    return valid;
  } catch {
    return [];
  }
}

export function savePendingNotificationQueue(queue: PendingNotificationItem[]): void {
  setStorageItem(PENDING_NOTIFICATION_QUEUE_KEY, JSON.stringify(queue));
}

export function enqueuePendingNotification(item: PendingNotificationItem): PendingNotificationItem[] {
  const current = getPendingNotificationQueue();
  // Filter out matching wordId so it is updated at the tail without duplicate entries
  const filtered = current.filter((q) => q.wordId !== item.wordId);
  filtered.push(item);
  savePendingNotificationQueue(filtered);
  return filtered;
}

export function dequeuePendingNotification(wordId?: string): PendingNotificationItem | null {
  const current = getPendingNotificationQueue();
  if (current.length === 0) return null;
  if (wordId) {
    const idx = current.findIndex((q) => q.wordId === wordId);
    if (idx !== -1) {
      const found = current[idx];
      current.splice(idx, 1);
      savePendingNotificationQueue(current);
      return found;
    }
  }
  const item = current.shift() || null;
  savePendingNotificationQueue(current);
  return item;
}

export function removePendingNotificationByWordId(wordId: string): void {
  const current = getPendingNotificationQueue();
  const updated = current.filter((q) => q.wordId !== wordId);
  savePendingNotificationQueue(updated);
}

export function clearPendingNotificationQueue(): void {
  removeStorageItem(PENDING_NOTIFICATION_QUEUE_KEY);
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

/**
 * Opens Android app notification channel settings.
 */
export async function openChannelSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (typeof VocoScheduler.openAppSettings === 'function') {
      await VocoScheduler.openAppSettings();
    } else {
      await VocoScheduler.openExactAlarmSettings();
    }
  } catch (err) {
    console.warn('[Voco] Could not open channel settings:', err);
  }
}

/**
 * Persists chosen theme ID to native Android storage so VocoQuizDialogActivity
 * opens in the exact same theme even when app is killed or swiped away.
 */
export async function syncThemeToNative(themeId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await VocoScheduler.saveTheme({ themeId });
  } catch (err) {
    console.warn('[Voco] syncThemeToNative note:', err);
  }
}

/**
 * Reads theme ID from native Android storage if present.
 */
export async function getNativeTheme(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await VocoScheduler.getSavedTheme();
    return res?.themeId || null;
  } catch {
    return null;
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
    clearSchedulePausedToday();
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
    const schedule = getDailyScheduleConfig();
    if (schedule.enabled && isInsideDailyScheduleWindow(schedule)) {
      markSchedulePausedToday();
    }
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
    // On native Android, native scheduler manages its own queue with identical queue logic
    await VocoScheduler.sendTestNotification({
      wordId: word.id,
      word: word.word,
      meaning: word.meaning,
      example: word.example || '',
      hindiMeaning: word.hindiMeaning || '',
      hindiExample: word.hindiExample || '',
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
  onOpenQuiz?: (word: VocabularyWord) => void,
  isTest = false
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    return scheduleTestNotification(word);
  }

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const title = isTest ? 'Voco — Test Practice! 🧪' : 'Voco — Practice Time!';
  const body = `What does ${word.word.toUpperCase()} mean?`;
  const url = `/?quiz=${encodeURIComponent(word.id)}`;

  try {
    const uniqueTag = `vocab-reminder-${word.id}-${Date.now()}`;
    enqueuePendingNotification({
      wordId: word.id,
      word: word.word,
      timestamp: Date.now(),
      isTest,
    });

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

// ─────────────────────────────────────────────
// Daily Schedule Service
// ─────────────────────────────────────────────

export const DAILY_SCHEDULE_STORAGE_KEY = 'voco_daily_schedule_config';
export const DAILY_SCHEDULE_PAUSED_KEY = 'voco_daily_schedule_paused_date';

export const DEFAULT_DAILY_SCHEDULE: DailyScheduleConfig = {
  enabled: false,
  startTime: '08:00',
  endTime: '21:00',
  days: [1, 2, 3, 4, 5, 6, 7], // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  notifyOnStartEnd: true,
  pausedDate: null,
};

export const DAY_CHIPS: { id: number; label: string; full: string }[] = [
  { id: 1, label: 'M', full: 'Mon' },
  { id: 2, label: 'T', full: 'Tue' },
  { id: 3, label: 'W', full: 'Wed' },
  { id: 4, label: 'T', full: 'Thu' },
  { id: 5, label: 'F', full: 'Fri' },
  { id: 6, label: 'S', full: 'Sat' },
  { id: 7, label: 'S', full: 'Sun' },
];

export function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const parts = time24.split(':');
  const hour = parseInt(parts[0], 10);
  const min = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(min)) return time24;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(min).padStart(2, '0')} ${ampm}`;
}

export function isOvernightWindow(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const [sh, sm] = startTime.split(':').map((v) => parseInt(v, 10));
  const [eh, em] = endTime.split(':').map((v) => parseInt(v, 10));
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return startMins > endMins;
}

export function getIsoDayOfWeek(date: Date = new Date()): number {
  const day = date.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  return day === 0 ? 7 : day;
}

export function getTodayDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isInsideDailyScheduleWindow(config: DailyScheduleConfig, now: Date = new Date()): boolean {
  if (!config.enabled) return false;
  const [sh, sm] = (config.startTime || '08:00').split(':').map((v) => parseInt(v, 10));
  const [eh, em] = (config.endTime || '21:00').split(':').map((v) => parseInt(v, 10));
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const currentIsoDay = getIsoDayOfWeek(now);
  const daysSet = new Set(config.days || [1, 2, 3, 4, 5, 6, 7]);

  if (startMins < endMins) {
    // Normal window (e.g. 08:00 - 21:00)
    return daysSet.has(currentIsoDay) && currentMins >= startMins && currentMins < endMins;
  } else if (startMins > endMins) {
    // Overnight window (e.g. 22:00 - 02:00)
    if (currentMins >= startMins) {
      return daysSet.has(currentIsoDay);
    } else if (currentMins < endMins) {
      const prevIsoDay = currentIsoDay === 1 ? 7 : currentIsoDay - 1;
      return daysSet.has(prevIsoDay);
    }
  }
  return false;
}

export function computeDailyScheduleStatus(
  config: DailyScheduleConfig,
  now: Date = new Date(),
  remindersActive: boolean = false
): {
  state: DailyScheduleState;
  summary: string;
  label: string;
  isInside: boolean;
  isPausedToday: boolean;
} {
  if (!config.enabled) {
    return {
      state: 'off',
      label: 'Off',
      summary: 'Automatic daily schedule is turned off.',
      isInside: false,
      isPausedToday: false,
    };
  }

  const todayStr = getTodayDateString(now);
  const pausedDate = config.pausedDate || getStorageItem(DAILY_SCHEDULE_PAUSED_KEY);
  const isPausedToday = todayStr === pausedDate;
  const isInside = isInsideDailyScheduleWindow(config, now);

  const startFormatted = formatTime12h(config.startTime);
  const endFormatted = formatTime12h(config.endTime);
  const interval = getSavedReminderInterval();

  const daysCount = (config.days || []).length;
  let daysSummary = 'every day';
  if (daysCount === 5 && !config.days.includes(6) && !config.days.includes(7)) {
    daysSummary = 'Mon–Fri';
  } else if (daysCount === 2 && config.days.includes(6) && config.days.includes(7)) {
    daysSummary = 'weekends';
  } else if (daysCount < 7) {
    daysSummary = `${daysCount} days/wk`;
  }

  const summary = `Reminders run ${startFormatted} – ${endFormatted}, every ${interval} min, ${daysSummary}`;

  if (isPausedToday) {
    return {
      state: 'paused',
      label: 'Paused for today',
      summary: `${summary} (resumes tomorrow at ${startFormatted})`,
      isInside,
      isPausedToday: true,
    };
  }

  if (isInside && (remindersActive || true)) {
    return {
      state: 'active',
      label: 'Active now',
      summary,
      isInside: true,
      isPausedToday: false,
    };
  }

  // Outside window
  const [sh, sm] = (config.startTime || '08:00').split(':').map((v) => parseInt(v, 10));
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const startMins = sh * 60 + sm;
  const currentIsoDay = getIsoDayOfWeek(now);
  const daysSet = new Set(config.days || []);

  let nextLabel = `Starts tomorrow ${startFormatted}`;
  if (daysSet.has(currentIsoDay) && currentMins < startMins) {
    nextLabel = `Starts today ${startFormatted}`;
  }

  return {
    state: 'scheduled',
    label: nextLabel,
    summary,
    isInside: false,
    isPausedToday: false,
  };
}

export function getDailyScheduleConfig(): DailyScheduleConfig {
  const raw = getStorageItem(DAILY_SCHEDULE_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_DAILY_SCHEDULE };
  try {
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      startTime: parsed.startTime || '08:00',
      endTime: parsed.endTime || '21:00',
      days: Array.isArray(parsed.days) && parsed.days.length > 0 ? parsed.days : [1, 2, 3, 4, 5, 6, 7],
      notifyOnStartEnd: parsed.notifyOnStartEnd !== false,
      pausedDate: parsed.pausedDate || getStorageItem(DAILY_SCHEDULE_PAUSED_KEY) || null,
    };
  } catch {
    return { ...DEFAULT_DAILY_SCHEDULE };
  }
}

export function setDailyScheduleConfig(config: DailyScheduleConfig): void {
  setStorageItem(DAILY_SCHEDULE_STORAGE_KEY, JSON.stringify(config));
  if (config.pausedDate) {
    setStorageItem(DAILY_SCHEDULE_PAUSED_KEY, config.pausedDate);
  } else {
    removeStorageItem(DAILY_SCHEDULE_PAUSED_KEY);
  }
}

export async function saveDailySchedule(config: DailyScheduleConfig): Promise<boolean> {
  setDailyScheduleConfig(config);

  if (Capacitor.isNativePlatform()) {
    try {
      await VocoScheduler.saveDailySchedule({
        enabled: config.enabled,
        startTime: config.startTime,
        endTime: config.endTime,
        days: JSON.stringify(config.days),
        notifyOnStartEnd: config.notifyOnStartEnd,
      });
      return true;
    } catch (err) {
      console.warn('[Voco] saveDailySchedule native error:', err);
      return false;
    }
  }
  return true;
}

export async function syncDailyScheduleFromNative(): Promise<DailyScheduleConfig | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const native = await VocoScheduler.getDailySchedule();
    if (!native) return null;
    let parsedDays = [1, 2, 3, 4, 5, 6, 7];
    try {
      parsedDays = JSON.parse(native.days);
    } catch {}
    const config: DailyScheduleConfig = {
      enabled: native.enabled,
      startTime: native.startTime || '08:00',
      endTime: native.endTime || '21:00',
      days: parsedDays,
      notifyOnStartEnd: native.notifyOnStartEnd !== false,
      pausedDate: native.isPausedToday ? getTodayDateString() : null,
    };
    setDailyScheduleConfig(config);
    return config;
  } catch {
    return null;
  }
}

export function markSchedulePausedToday(): void {
  const today = getTodayDateString();
  setStorageItem(DAILY_SCHEDULE_PAUSED_KEY, today);
  const cfg = getDailyScheduleConfig();
  cfg.pausedDate = today;
  setDailyScheduleConfig(cfg);
}

export function clearSchedulePausedToday(): void {
  removeStorageItem(DAILY_SCHEDULE_PAUSED_KEY);
  const cfg = getDailyScheduleConfig();
  cfg.pausedDate = null;
  setDailyScheduleConfig(cfg);
}
