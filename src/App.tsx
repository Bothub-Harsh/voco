import { useState, useEffect, useCallback, useRef } from 'react';
import type { VocabularyWord, BackendStatus, StorageStatus, ActiveQuizSession } from './types';
import {
  getAllWords,
  saveWord,
  saveManualWord,
  updateWord,
  deleteWord,
  getWordById,
  seedInitialWordIfEmpty,
  requestPersistentStorage,
  migrateFromLocalStorageIfPresent,
} from './db/indexedDb';
import {
  generateVocabularyFromAI,
  refreshVocabularyFromAI,
  checkBackendStatus,
  getApiBaseUrl,
} from './services/api';
import { generateFreshQuizSession } from './services/quizGenerator';
import {
  isRemindersActive,
  setRemindersActive as persistRemindersActive,
  requestNotificationPermission,
  getNotificationPermission,
  checkNotificationPermissionAsync,
  pickNextReminderWord,
  dispatchWordNotification,
  getSavedReminderInterval,
  setSavedReminderInterval,
  getNextReminderTimestamp,
  setNextReminderTimestamp,
  setupNotificationListeners,
  isNativeApp,
  scheduleNativeReminders,
  syncWordsWithNativeScheduler,
  cancelAllNativeReminders,
  scheduleTestNotification,
  getNativeReminderStatus,
  checkExactAlarmPermission,
  openExactAlarmSettings,
  ensureNotificationChannel,
} from './services/notifications';
import { Header } from './components/Header';
import { StorageStatusIndicator } from './components/StorageStatusIndicator';
import { AddWordForm } from './components/AddWordForm';
import { ReminderControls } from './components/ReminderControls';
import { WordList } from './components/WordList';
import { QuizScreen } from './components/QuizScreen';
import { BottomNav, type TabId } from './components/BottomNav';
import { SettingsTab } from './components/SettingsTab';
import { initTheme, toggleTheme, type Theme } from './services/theme';
import { CheckCircle2 } from 'lucide-react';

export function App() {
  // ─── Core UI state ───
  const [theme, setTheme] = useState<Theme>(() => initTheme());
  const [activeTab, setActiveTab] = useState<TabId>('add');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── Data state ───
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [activeQuizSession, setActiveQuizSession] = useState<ActiveQuizSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedWord, setLastFailedWord] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [remindersActive, setRemindersActiveState] = useState<boolean>(isRemindersActive());
  const [reminderInterval, setReminderInterval] = useState<number>(getSavedReminderInterval());
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission()
  );
  const [isPersistent, setIsPersistent] = useState<boolean>(false);
  const [refreshingWordId, setRefreshingWordId] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<{ wordId: string; message: string } | null>(null);
  const [highlightedWordId, setHighlightedWordId] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    state: 'idle',
    message: 'Initializing local database...',
  });

  // Keep a ref to words so the reminder interval closure always has the latest words
  const wordsRef = useRef<VocabularyWord[]>(words);
  wordsRef.current = words;

  // ─── Data loading ───
  const refreshWords = useCallback(async () => {
    try {
      const loaded = await getAllWords();
      setWords(loaded);
      return loaded;
    } catch (err) {
      console.error('Failed to load words from IndexedDB:', err);
      setStorageStatus({
        state: 'error',
        message: 'Failed to read words from IndexedDB',
      });
      return [];
    }
  }, []);

  // Opens a fresh randomized quiz session for a saved word
  const openQuizForWord = useCallback((word: VocabularyWord) => {
    const freshSession = generateFreshQuizSession(word, wordsRef.current);
    setActiveQuizSession(freshSession);
  }, []);

  // Generates a fresh set of options and distractors for another quiz attempt on the same word
  const handleTryAgainQuiz = useCallback((wordId: string) => {
    const currentWord = wordsRef.current.find((w) => w.id === wordId);
    if (currentWord) {
      // Pass previous correctIndex to guarantee position shifts on consecutive attempts
      const prevIdx = activeQuizSession?.correctIndex;
      const freshSession = generateFreshQuizSession(currentWord, wordsRef.current, prevIdx);
      setActiveQuizSession(freshSession);
    }
  }, [activeQuizSession]);

  // Check URL params for ?quiz=<id> (from notifications)
  const checkUrlForQuiz = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('quiz');
    if (quizId) {
      const found = await getWordById(quizId);
      if (found) {
        openQuizForWord(found);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [openQuizForWord]);

  // ─── Initialization ───
  useEffect(() => {
    const initializeStorage = async () => {
      // 1. Request persistent storage from browser
      const persistentGranted = await requestPersistentStorage();
      setIsPersistent(persistentGranted);

      // 2. Migrate any legacy data from localStorage without deleting it
      try {
        const migration = await migrateFromLocalStorageIfPresent();
        if (migration.migratedCount > 0) {
          console.log(`Migrated ${migration.migratedCount} words from localStorage.`);
        }
      } catch (err) {
        console.warn('LocalStorage migration note:', err);
      }

      // 3. Seed starter word if empty
      await seedInitialWordIfEmpty();

      // 4. Initialize native notification channel and sync state if running as Android APK
      if (isNativeApp()) {
        await ensureNotificationChannel();
        try {
          const nativeStatus = await getNativeReminderStatus();
          if (nativeStatus) {
            if (nativeStatus.active) {
              persistRemindersActive(true);
              setRemindersActiveState(true);
              if (nativeStatus.intervalMinutes) {
                setReminderInterval(nativeStatus.intervalMinutes);
                setSavedReminderInterval(nativeStatus.intervalMinutes);
              }
              if (nativeStatus.nextTrigger && nativeStatus.nextTrigger > Date.now()) {
                setNextReminderTimestamp(nativeStatus.nextTrigger);
              }
            } else {
              persistRemindersActive(false);
              setRemindersActiveState(false);
              setNextReminderTimestamp(null);
            }
          }
        } catch (e) {
          console.warn('[Voco] Native status check note:', e);
        }
      }

      // 5. Load from IndexedDB
      const loaded = await refreshWords();
      setStorageStatus({
        state: 'saved',
        message: `${loaded.length} word${loaded.length === 1 ? '' : 's'} loaded from IndexedDB`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      // Keep native word bank in sync with saved words
      if (isNativeApp() && loaded.length > 0) {
        syncWordsWithNativeScheduler(loaded).catch(() => {});
      }

      // 6. Check if quiz was requested via URL query param
      checkUrlForQuiz();
    };

    initializeStorage();

    // Check backend proxy status
    checkBackendStatus().then(setBackendStatus);

    // Check native notification permission on mount
    checkNotificationPermissionAsync().then(setPermission);

    // Setup native notification click listener
    setupNotificationListeners(async (wordId) => {
      const found = await getWordById(wordId);
      if (found) {
        openQuizForWord(found);
      }
    });

    // Online/offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      checkBackendStatus().then(setBackendStatus);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for custom quiz open events
    const handleOpenQuizEvent = async (e: Event) => {
      const customEvent = e as CustomEvent<{ wordId: string }>;
      if (customEvent.detail?.wordId) {
        const found = await getWordById(customEvent.detail.wordId);
        if (found) {
          openQuizForWord(found);
        }
      }
    };
    window.addEventListener('open-vocabulary-quiz', handleOpenQuizEvent);

    // Register service worker if available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('open-vocabulary-quiz', handleOpenQuizEvent);
    };
  }, [refreshWords, checkUrlForQuiz, openQuizForWord]);

  // ─── Reminder countdown timer (runs regardless of active tab) ───
  useEffect(() => {
    if (!remindersActive) {
      setSecondsRemaining(null);
      return;
    }

    const intervalMs = reminderInterval * 60 * 1000;
    let target = getNextReminderTimestamp();
    const now = Date.now();

    if (!target || target <= now) {
      target = now + intervalMs;
      setNextReminderTimestamp(target);
    }

    setSecondsRemaining(Math.max(0, Math.ceil((target - now) / 1000)));

    const ticker = setInterval(() => {
      const currentNow = Date.now();
      const currentTarget = getNextReminderTimestamp() || (currentNow + intervalMs);
      const diffMs = currentTarget - currentNow;
      const secs = Math.max(0, Math.ceil(diffMs / 1000));
      setSecondsRemaining(secs);

      if (diffMs <= 0) {
        // Schedule next visual countdown target
        const newTarget = Date.now() + intervalMs;
        setNextReminderTimestamp(newTarget);
        setSecondsRemaining(reminderInterval * 60);

        // On browser web: trigger browser notification via JS timer
        // On native Android: Android native AlarmManager delivers reminders independently
        if (!isNativeApp()) {
          const words = wordsRef.current;
          const nextWord = pickNextReminderWord(words);
          if (nextWord) {
            dispatchWordNotification(nextWord, (w) => openQuizForWord(w));
          }
        }
      }
    }, 1000);

    return () => clearInterval(ticker);
  }, [remindersActive, reminderInterval, openQuizForWord]);

  // ─── Handlers ───

  const handleChangeInterval = async (newMinutes: number) => {
    const clamped = Math.max(1, Math.floor(newMinutes));
    setReminderInterval(clamped);
    setSavedReminderInterval(clamped);

    if (remindersActive) {
      // Reset countdown to the new interval immediately
      const newTarget = Date.now() + clamped * 60 * 1000;
      setNextReminderTimestamp(newTarget);
      setSecondsRemaining(clamped * 60);

      // On native platform, re-schedule future alarms with the updated interval
      if (isNativeApp() && wordsRef.current.length > 0) {
        await scheduleNativeReminders(wordsRef.current, clamped);
      }
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Add word action: Generates content, validates, then awaits IndexedDB write before updating list
  const handleAddWord = async (inputWord: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastFailedWord(null);

    setStorageStatus({
      state: 'saving',
      message: 'Generating definition with Groq AI...',
    });

    try {
      // 1. Generate via Groq proxy
      const generated = await generateVocabularyFromAI(inputWord);

      setStorageStatus({
        state: 'saving',
        message: 'Writing record to local IndexedDB...',
      });

      // 2. Await IndexedDB write completion (checks duplicates and commits transaction)
      const saved = await saveWord(generated);

      // 3. Update React state by re-reading directly from IndexedDB (source of truth)
      const updatedList = await refreshWords();

      // Synchronize native Android word bank so background reminders rotate new word
      if (isNativeApp() && updatedList.length > 0) {
        syncWordsWithNativeScheduler(updatedList).catch(() => {});
      }

      setStorageStatus({
        state: 'saved',
        message: `"${saved.word}" saved locally in IndexedDB`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      // Highlight the newly added word for the user to view its meaning and example
      setHighlightedWordId(saved.id);

      // Show success message
      showSuccess(`"${saved.word}" saved successfully!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add word.';
      setErrorMessage(msg);
      setLastFailedWord(inputWord);
      setStorageStatus({
        state: 'error',
        message: `Save failed: ${msg}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedWord) {
      handleAddWord(lastFailedWord);
    }
  };

  // Add manual word action: saves user-written meaning and example directly to IndexedDB
  const handleAddManualWord = async (inputWord: string, meaning: string, example?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastFailedWord(null);

    setStorageStatus({
      state: 'saving',
      message: `Writing "${inputWord}" to local IndexedDB...`,
    });

    try {
      const saved = await saveManualWord({ word: inputWord, meaning, example });
      const updatedList = await refreshWords();

      // Synchronize native Android word bank so background reminders rotate new word
      if (isNativeApp() && updatedList.length > 0) {
        syncWordsWithNativeScheduler(updatedList).catch(() => {});
      }

      setStorageStatus({
        state: 'saved',
        message: `"${saved.word}" saved locally in IndexedDB`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      // Highlight the newly added word for the user
      setHighlightedWordId(saved.id);

      // Show success message
      showSuccess(`"${saved.word}" saved successfully!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save manual word.';
      setErrorMessage(msg);
      setStorageStatus({
        state: 'error',
        message: `Save failed: ${msg}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh word explanation action: generates fresh alternative wording and persists to IndexedDB
  const handleRefreshWord = async (wordToRefresh: VocabularyWord) => {
    setRefreshingWordId(wordToRefresh.id);
    setRefreshError(null);

    setStorageStatus({
      state: 'saving',
      message: `Generating new explanation for "${wordToRefresh.word}"...`,
    });

    try {
      const refreshed = await refreshVocabularyFromAI(
        wordToRefresh.word,
        wordToRefresh.meaning,
        wordToRefresh.example
      );

      const updatedWord: VocabularyWord = {
        ...wordToRefresh,
        meaning: refreshed.meaning,
        example: refreshed.example,
        options: refreshed.options,
        correctIndex: refreshed.correctIndex,
      };

      await updateWord(updatedWord);
      await refreshWords();

      setStorageStatus({
        state: 'saved',
        message: `New explanation for "${wordToRefresh.word}" saved in IndexedDB`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh explanation.';
      setRefreshError({ wordId: wordToRefresh.id, message: msg });
      setStorageStatus({
        state: 'error',
        message: `Refresh failed: ${msg}`,
      });
    } finally {
      setRefreshingWordId(null);
    }
  };

  const handleClearRefreshError = (wordId: string) => {
    if (refreshError?.wordId === wordId) {
      setRefreshError(null);
    }
  };

  const handleUpdateWord = async (updated: VocabularyWord) => {
    setStorageStatus({
      state: 'saving',
      message: `Updating "${updated.word}" in IndexedDB...`,
    });

    try {
      await updateWord(updated);
      await refreshWords();
      setStorageStatus({
        state: 'saved',
        message: `"${updated.word}" updated locally in IndexedDB`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setStorageStatus({
        state: 'error',
        message: `Update failed: ${msg}`,
      });
      throw err;
    }
  };

  const handleDeleteWord = async (id: string, wordSpelling: string) => {
    setStorageStatus({
      state: 'saving',
      message: `Removing "${wordSpelling}" from IndexedDB...`,
    });

    try {
      await deleteWord(id);
      const remainingWords = await refreshWords();

      // If reminders active, refresh native words bank or cancel if no words left
      if (isRemindersActive() && isNativeApp()) {
        if (remainingWords.length > 0) {
          syncWordsWithNativeScheduler(remainingWords).catch(() => {});
        } else {
          cancelAllNativeReminders().catch(() => {});
          persistRemindersActive(false);
          setRemindersActiveState(false);
        }
      }
      setStorageStatus({
        state: 'saved',
        message: `"${wordSpelling}" deleted from IndexedDB`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      if (activeQuizSession?.wordId === id) {
        setActiveQuizSession(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setStorageStatus({
        state: 'error',
        message: `Delete failed: ${msg}`,
      });
      alert(`Could not delete word: ${msg}`);
    }
  };

  const handleBackupStatusChange = (message: string, isError = false) => {
    setStorageStatus({
      state: isError ? 'error' : 'saved',
      message,
      lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleCheckBackend = async () => {
    const status = await checkBackendStatus();
    setBackendStatus(status);
  };

  const handleStartReminders = async () => {
    if (wordsRef.current.length === 0) {
      alert('Save at least one word first before starting reminders.');
      return;
    }

    const granted = await requestNotificationPermission();
    const currentPerm = await checkNotificationPermissionAsync();
    setPermission(currentPerm);

    if (granted) {
      if (isNativeApp()) {
        try {
          const exactStatus = await checkExactAlarmPermission();
          if (exactStatus === 'prompt') {
            const wantsToEnable = confirm(
              'For practice reminders to arrive at exact minute intervals in the background, Android requires the "Alarms & reminders" permission.\n\nWould you like to open Settings to allow it for Voco now?'
            );
            if (wantsToEnable) {
              await openExactAlarmSettings();
            }
          }
        } catch (e) {
          console.warn('[Voco] Exact alarm check note:', e);
        }

        await scheduleNativeReminders(wordsRef.current, reminderInterval);
      }

      persistRemindersActive(true);
      setRemindersActiveState(true);

      const target = getNextReminderTimestamp() || (Date.now() + reminderInterval * 60 * 1000);
      setNextReminderTimestamp(target);
      const remainingSecs = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setSecondsRemaining(remainingSecs > 0 ? remainingSecs : reminderInterval * 60);
    } else {
      if (isNativeApp()) {
        alert(
          'Notification permission was not granted. Please allow notifications for Voco in your Android Settings (Settings > Apps > Voco > Notifications).'
        );
      } else {
        alert('Notification permission was not granted. Please allow notifications in your browser.');
      }
    }
  };

  const handleStopReminders = async () => {
    persistRemindersActive(false);
    setRemindersActiveState(false);
    setSecondsRemaining(null);
    setNextReminderTimestamp(null);

    if (isNativeApp()) {
      await cancelAllNativeReminders();
    }
  };

  const handleTestNotification = async () => {
    const granted = await requestNotificationPermission();
    const currentPerm = await checkNotificationPermissionAsync();
    setPermission(currentPerm);

    if (!granted) {
      if (isNativeApp()) {
        alert(
          'Notification permission is disabled. Please allow notifications in Android Settings > Apps > Voco > Notifications to test reminders.'
        );
      } else {
        alert('Please enable browser notifications to test reminders.');
      }
      return;
    }

    const nextWord = pickNextReminderWord(wordsRef.current);
    if (!nextWord) {
      alert('Save at least one word first before sending reminders.');
      return;
    }

    if (isNativeApp()) {
      const scheduled = await scheduleTestNotification(nextWord);
      if (!scheduled) {
        alert('Could not deliver notification. Check your Android notification settings.');
      }
    } else {
      const sent = await dispatchWordNotification(nextWord, (w) => openQuizForWord(w));
      if (!sent) {
        alert('Could not deliver notification. Check your browser notification settings.');
      }
    }
  };

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  // ─── Render ───
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#F8FAFC] dark:bg-black flex flex-col font-sans text-slate-800 dark:text-slate-100 safe-left safe-right transition-colors duration-200">
      <Header
        isOnline={isOnline}
        backendStatus={backendStatus}
        savedWordsCount={words.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main content area — pb-20 ensures content isn't hidden behind bottom nav */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 pt-4 sm:pt-5 pb-24">

        {/* ━━━ TAB 1: ADD WORDS ━━━ */}
        {activeTab === 'add' && (
          <div className="animate-fade-in-up">
            {/* Backend Connectivity / API Key Status Banner */}
            {backendStatus && !backendStatus.reachable && (
              <div className="mb-4 p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl text-amber-900 dark:text-amber-200 text-xs shadow-card flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-amber-950 dark:text-amber-100 text-sm">
                    Connecting to Vocabulary Server...
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                    The cloud AI backend ({getApiBaseUrl()}) is currently unreachable or spinning up (on free tier hosting, waking up takes ~20-30 seconds). You can still practice saved words and write your own meanings offline!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckBackend}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-xs"
                >
                  Retry
                </button>
              </div>
            )}

            {backendStatus && backendStatus.reachable && !backendStatus.configured && (
              <div className="mb-4 p-4 bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-2xl text-rose-900 dark:text-rose-200 text-xs shadow-card">
                <p className="font-bold text-rose-950 dark:text-rose-100 text-sm">
                  Backend Configuration Notice
                </p>
                <p className="text-rose-800 dark:text-rose-300 mt-1 leading-relaxed">
                  The vocabulary server at <code className="bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded font-mono font-semibold">{getApiBaseUrl()}</code> is online, but <code className="bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded font-mono font-semibold">GROQ_API_KEY</code> is not configured on the backend hosting service. Please set the key in your Render dashboard environment variables.
                </p>
              </div>
            )}

            {/* Storage Status */}
            <StorageStatusIndicator
              status={storageStatus}
              isPersistent={isPersistent}
            />

            {/* Success message */}
            {successMessage && (
              <div className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl text-emerald-800 dark:text-emerald-200 text-sm flex items-center space-x-2.5 shadow-card animate-fade-in-up">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                    Word saved successfully!
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {successMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Add Word Form */}
            <AddWordForm
              onAddWord={handleAddWord}
              onAddManualWord={handleAddManualWord}
              isLoading={isLoading}
              error={errorMessage}
              onRetry={handleRetry}
              lastFailedWord={lastFailedWord}
            />

            {/* Practice Reminders */}
            <ReminderControls
              remindersActive={remindersActive}
              onStartReminders={handleStartReminders}
              onStopReminders={handleStopReminders}
              onTestNotification={handleTestNotification}
              words={words}
              permission={permission}
              intervalMinutes={reminderInterval}
              onChangeInterval={handleChangeInterval}
              secondsRemaining={secondsRemaining}
            />
          </div>
        )}

        {/* ━━━ TAB 2: SAVED WORDS ━━━ */}
        {activeTab === 'saved' && (
          <WordList
            words={words}
            onOpenQuiz={(word) => openQuizForWord(word)}
            onDeleteWord={handleDeleteWord}
            onUpdateWord={handleUpdateWord}
            onRefreshWord={handleRefreshWord}
            refreshingWordId={refreshingWordId}
            refreshError={refreshError}
            onClearRefreshError={handleClearRefreshError}
            highlightedWordId={highlightedWordId}
          />
        )}

        {/* ━━━ TAB 3: SETTINGS ━━━ */}
        {activeTab === 'settings' && (
          <SettingsTab
            theme={theme}
            onToggleTheme={handleToggleTheme}
            totalWords={words.length}
            onRefreshWords={refreshWords}
            onStatusChange={handleBackupStatusChange}
            permission={permission}
            isPersistent={isPersistent}
            isOnline={isOnline}
            backendStatus={backendStatus}
            storageStatus={storageStatus}
          />
        )}
      </main>

      {/* Quiz Modal — always rendered on top regardless of active tab */}
      {activeQuizSession && (
        <QuizScreen
          quiz={activeQuizSession}
          onClose={() => setActiveQuizSession(null)}
          onTryAgain={() => handleTryAgainQuiz(activeQuizSession.wordId)}
        />
      )}

      {/* Fixed Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        savedWordsCount={words.length}
      />
    </div>
  );
}

export default App;
