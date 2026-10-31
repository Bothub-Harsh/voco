import { useState, useEffect, useCallback, useRef } from 'react';
import type { VocabularyWord, BackendStatus, StorageStatus, ActiveQuizSession } from './types';
import {
  getAllWords,
  saveWord,
  saveManualWord,
  updateWord,
  deleteWord,
  deleteWords,
  getWordById,
  seedInitialWordIfEmpty,
  requestPersistentStorage,
  migrateFromLocalStorageIfPresent,
} from './db/indexedDb';
import {
  generateVocabularyFromAI,
  refreshVocabularyFromAI,
  checkBackendStatus,
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
import { AddWordForm } from './components/AddWordForm';
import { ReminderControls } from './components/ReminderControls';
import { WordList } from './components/WordList';
import { QuizScreen } from './components/QuizScreen';
import { BottomNav, type TabId } from './components/BottomNav';
import { SettingsTab } from './components/SettingsTab';
import { initTheme, toggleTheme, type Theme } from './services/theme';
import { CheckCircle2 } from 'lucide-react';

const TABS: TabId[] = ['add', 'saved', 'settings'];

/** Minimum horizontal swipe distance in px to trigger navigation */
const SWIPE_THRESHOLD_PX = 48;
/** Max angle from horizontal (in degrees) to count as a swipe, not a scroll */
const SWIPE_MAX_ANGLE_DEG = 28;
/** Max duration in ms for a swipe gesture to be recognised */
const SWIPE_MAX_MS = 700;

export function App() {
  // ─── UI State ───
  const [theme, setTheme] = useState<Theme>(() => initTheme());
  const [activeTab, setActiveTab] = useState<TabId>('add');
  const [successMessage, setSuccessMessage] = useState<boolean>(false);

  // ─── Vocabulary & Database State ───
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [activeQuizSession, setActiveQuizSession] = useState<ActiveQuizSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedWord, setLastFailedWord] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [isPersistent, setIsPersistent] = useState<boolean>(false);
  const [refreshingWordId, setRefreshingWordId] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<{ wordId: string; message: string } | null>(null);
  const [highlightedWordId, setHighlightedWordId] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    state: 'idle',
    message: 'Local database ready',
  });

  // ─── Reminder & Notification State ───
  const [remindersActive, setRemindersActiveState] = useState<boolean>(isRemindersActive());
  const [reminderInterval, setReminderInterval] = useState<number>(getSavedReminderInterval());
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission()
  );

  // Keep a ref to words so the reminder interval closure always has the latest words
  const wordsRef = useRef<VocabularyWord[]>(words);
  wordsRef.current = words;

  // ─── Data Loading ───
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

      // 2. Migrate legacy data if present
      try {
        await migrateFromLocalStorageIfPresent();
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

      // 5. Load words from IndexedDB
      const loaded = await refreshWords();
      setStorageStatus({
        state: 'saved',
        message: `${loaded.length} word${loaded.length === 1 ? '' : 's'} stored locally`,
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

    // Check backend status
    checkBackendStatus().then(setBackendStatus);

    // Check notification permission on mount
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

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('open-vocabulary-quiz', handleOpenQuizEvent);
    };
  }, [refreshWords, checkUrlForQuiz, openQuizForWord]);

  // ─── Mobile Viewport Lock (Prevent window-level scroll offsets on soft keyboard show/hide) ───
  useEffect(() => {
    const resetScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener('scroll', resetScroll, { passive: true });
    window.addEventListener('blur', resetScroll, true);
    window.addEventListener('resize', resetScroll);
    return () => {
      window.removeEventListener('scroll', resetScroll);
      window.removeEventListener('blur', resetScroll, true);
      window.removeEventListener('resize', resetScroll);
    };
  }, []);

  // ─── Reminder Timer (Runs continuously across all tabs) ───
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
        const newTarget = Date.now() + intervalMs;
        setNextReminderTimestamp(newTarget);
        setSecondsRemaining(reminderInterval * 60);

        if (!isNativeApp()) {
          const currentWords = wordsRef.current;
          const nextWord = pickNextReminderWord(currentWords);
          if (nextWord) {
            dispatchWordNotification(nextWord, (w) => openQuizForWord(w));
          }
        }
      }
    }, 1000);

    return () => clearInterval(ticker);
  }, [remindersActive, reminderInterval, openQuizForWord]);

  // ─── Actions & Handlers ───

  const triggerSuccessMessage = () => {
    setSuccessMessage(true);
    setTimeout(() => {
      setSuccessMessage(false);
    }, 3000);
  };

  const handleChangeInterval = async (newMinutes: number) => {
    const clamped = Math.max(1, Math.floor(newMinutes));
    setReminderInterval(clamped);
    setSavedReminderInterval(clamped);

    if (remindersActive) {
      const newTarget = Date.now() + clamped * 60 * 1000;
      setNextReminderTimestamp(newTarget);
      setSecondsRemaining(clamped * 60);

      if (isNativeApp() && wordsRef.current.length > 0) {
        await scheduleNativeReminders(wordsRef.current, clamped);
      }
    }
  };

  const handleAddWord = async (inputWord: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastFailedWord(null);

    try {
      const generated = await generateVocabularyFromAI(inputWord);
      const saved = await saveWord(generated);
      const updatedList = await refreshWords();

      if (isNativeApp() && updatedList.length > 0) {
        syncWordsWithNativeScheduler(updatedList).catch(() => {});
      }

      setStorageStatus({
        state: 'saved',
        message: `"${saved.word}" saved locally`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      setHighlightedWordId(saved.id);
      triggerSuccessMessage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add word.';
      setErrorMessage(msg);
      setLastFailedWord(inputWord);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedWord) {
      handleAddWord(lastFailedWord);
    }
  };

  const handleAddManualWord = async (
    inputWord: string,
    meaning: string,
    example?: string,
    hindiMeaning?: string,
    hindiExample?: string
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastFailedWord(null);

    try {
      const saved = await saveManualWord({
        word: inputWord,
        meaning,
        example,
        hindiMeaning,
        hindiExample,
      });
      const updatedList = await refreshWords();

      if (isNativeApp() && updatedList.length > 0) {
        syncWordsWithNativeScheduler(updatedList).catch(() => {});
      }

      setStorageStatus({
        state: 'saved',
        message: `"${saved.word}" saved locally`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      setHighlightedWordId(saved.id);
      triggerSuccessMessage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save word.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshWord = async (wordToRefresh: VocabularyWord) => {
    setRefreshingWordId(wordToRefresh.id);
    setRefreshError(null);

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
        hindiMeaning: refreshed.hindiMeaning ?? wordToRefresh.hindiMeaning,
        hindiExample: refreshed.hindiExample ?? wordToRefresh.hindiExample,
      };

      await updateWord(updatedWord);
      await refreshWords();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh explanation.';
      setRefreshError({ wordId: wordToRefresh.id, message: msg });
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
    try {
      await updateWord(updated);
      await refreshWords();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      throw new Error(msg);
    }
  };

  const handleDeleteWord = async (id: string, wordSpelling: string) => {
    try {
      await deleteWord(id);
      const remainingWords = await refreshWords();

      setStorageStatus({
        state: 'saved',
        message: `"${wordSpelling}" deleted`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      if (isRemindersActive() && isNativeApp()) {
        if (remainingWords.length > 0) {
          syncWordsWithNativeScheduler(remainingWords).catch(() => {});
        } else {
          cancelAllNativeReminders().catch(() => {});
          persistRemindersActive(false);
          setRemindersActiveState(false);
        }
      }

      if (activeQuizSession?.wordId === id) {
        setActiveQuizSession(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      alert(`Could not delete word: ${msg}`);
    }
  };

  const handleDeleteBatch = async (ids: string[]) => {
    try {
      await deleteWords(ids);
      const remainingWords = await refreshWords();

      setStorageStatus({
        state: 'saved',
        message: `${ids.length} word${ids.length === 1 ? '' : 's'} deleted`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      if (isRemindersActive() && isNativeApp()) {
        if (remainingWords.length > 0) {
          syncWordsWithNativeScheduler(remainingWords).catch(() => {});
        } else {
          cancelAllNativeReminders().catch(() => {});
          persistRemindersActive(false);
          setRemindersActiveState(false);
        }
      }

      if (activeQuizSession && ids.includes(activeQuizSession.wordId)) {
        setActiveQuizSession(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      alert(`Could not delete words: ${msg}`);
    }
  };

  const handleBackupStatusChange = (message: string, isError = false) => {
    setStorageStatus({
      state: isError ? 'error' : 'saved',
      message,
      lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
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
              'For reminders to arrive at exact minute intervals in the background, Android requires the "Alarms & reminders" permission.\n\nOpen Settings to enable it?'
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
          'Notification permission was not granted. Please allow notifications in Android Settings > Apps > Voco > Notifications.'
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
      alert('Please enable notifications to receive practice reminders.');
      return;
    }

    const nextWord = pickNextReminderWord(wordsRef.current);
    if (!nextWord) {
      alert('Save at least one word first before testing reminders.');
      return;
    }

    if (isNativeApp()) {
      const scheduled = await scheduleTestNotification(nextWord);
      if (!scheduled) {
        alert('Could not deliver test notification. Check notification permissions.');
      }
    } else {
      const sent = await dispatchWordNotification(nextWord, (w) => openQuizForWord(w));
      if (!sent) {
        alert('Could not deliver test notification. Check browser permissions.');
      }
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    const current = await checkNotificationPermissionAsync();
    setPermission(current);
    if (!granted && isNativeApp()) {
      await openExactAlarmSettings();
    }
  };

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  // ─── Swipe Navigation ───
  // Keep active tab index in a ref for touch handlers (avoids stale closures)
  const activeTabIndexRef = useRef<number>(TABS.indexOf('add'));
  const slideViewportRef = useRef<HTMLDivElement>(null);

  // Sync ref when state changes (e.g., bottom nav tap)
  useEffect(() => {
    activeTabIndexRef.current = TABS.indexOf(activeTab);
    // Snap to position immediately (no animation) when tab changes via bottom nav / external
    const vp = slideViewportRef.current;
    if (!vp) return;
    vp.classList.remove('is-animating');
    vp.style.transform = `translateX(-${activeTabIndexRef.current * (100 / 3)}%)`;
  }, [activeTab]);

  const swipeState = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    active: boolean;
    directionLocked: boolean;
    isHorizontal: boolean;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    active: false,
    directionLocked: false,
    isHorizontal: false,
  });

  const navigateToTab = useCallback((index: number, animate = true) => {
    const clamped = Math.max(0, Math.min(TABS.length - 1, index));
    const vp = slideViewportRef.current;
    if (vp) {
      if (animate) {
        vp.classList.add('is-animating');
        const onEnd = () => {
          vp.classList.remove('is-animating');
          vp.removeEventListener('transitionend', onEnd);
        };
        vp.addEventListener('transitionend', onEnd);
      } else {
        vp.classList.remove('is-animating');
      }
      vp.style.transform = `translateX(-${clamped * (100 / 3)}%)`;
    }
    activeTabIndexRef.current = clamped;
    setActiveTab(TABS[clamped]);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Only track single-finger touches
    if (e.touches.length > 1) {
      swipeState.current.active = false;
      return;
    }
    const target = e.target as HTMLElement | null;
    // Never intercept touches on interactive or scrollable elements
    if (target?.closest(
      'input, textarea, select, button, [role="dialog"], [role="slider"], .no-swipe, a'
    )) {
      swipeState.current.active = false;
      return;
    }
    swipeState.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTime: Date.now(),
      active: true,
      directionLocked: false,
      isHorizontal: false,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const s = swipeState.current;
    if (!s.active) return;

    const dx = e.touches[0].clientX - s.startX;
    const dy = e.touches[0].clientY - s.startY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // Lock direction after 8px of movement to decide swipe vs scroll
    if (!s.directionLocked && (adx > 8 || ady > 8)) {
      s.directionLocked = true;
      const angleRad = Math.atan2(ady, adx);
      const angleDeg = (angleRad * 180) / Math.PI;
      s.isHorizontal = angleDeg < SWIPE_MAX_ANGLE_DEG;
    }

    if (!s.directionLocked || !s.isHorizontal) return;

    // Prevent vertical page scroll while tracking horizontal swipe
    e.preventDefault();

    // Drag the viewport with the finger (rubber-banded at edges)
    const vp = slideViewportRef.current;
    if (!vp) return;
    const currentIndex = activeTabIndexRef.current;
    const baseX = -(currentIndex * (100 / 3));
    // Convert pixel drag to percentage of total viewport (300% wide)
    const pct = (dx / window.innerWidth) * (100 / 3) * (100 / 100);
    const clampedPct = Math.max(
      -(((TABS.length - 1) * (100 / 3)) - baseX - (100 / 3)),
      Math.min(-(baseX - (100 / 3)), pct)
    );
    vp.classList.remove('is-animating');
    vp.style.transform = `translateX(${baseX + clampedPct}%)`;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const s = swipeState.current;
    if (!s.active || !s.directionLocked || !s.isHorizontal) {
      swipeState.current.active = false;
      return;
    }
    swipeState.current.active = false;

    if (e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - s.startX;
    const dy = e.changedTouches[0].clientY - s.startY;
    const elapsed = Date.now() - s.startTime;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // Confirm it's still mostly horizontal and within time limit
    if (adx < SWIPE_THRESHOLD_PX || ady > adx * Math.tan((SWIPE_MAX_ANGLE_DEG * Math.PI) / 180) || elapsed > SWIPE_MAX_MS) {
      // Snap back to current
      navigateToTab(activeTabIndexRef.current, true);
      return;
    }

    const currentIndex = activeTabIndexRef.current;
    if (dx < 0 && currentIndex < TABS.length - 1) {
      navigateToTab(currentIndex + 1);
    } else if (dx > 0 && currentIndex > 0) {
      navigateToTab(currentIndex - 1);
    } else {
      // Edge: snap back
      navigateToTab(currentIndex, true);
    }
  }, [navigateToTab]);

  return (
    <div className="h-full h-[100dvh] bg-[#F8FAFC] dark:bg-[#121318] flex flex-col font-sans text-slate-800 dark:text-[#F1F1F5] safe-left safe-right transition-colors duration-300 overflow-hidden w-full relative">
      <Header
        isOnline={isOnline}
        backendStatus={backendStatus}
        savedWordsCount={words.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* ── Swipe Viewport Outer Container ── */}
      <div
        className="flex-1 min-h-0 w-full overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 300%-wide sliding strip containing the 3 panels */}
        <div
          ref={slideViewportRef}
          className="slide-viewport h-full"
          style={{ transform: `translateX(-${TABS.indexOf(activeTab) * (100 / 3)}%)` }}
        >
          {/* ━━━ PANEL 1: ADD WORDS ━━━ */}
          <div className="slide-panel">
            <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 pt-3 sm:pt-4 pb-6 sm:pb-8 space-y-3">
              {/* Small Clean Success Message */}
              {successMessage && (
                <div className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2 shadow-xs transition-opacity">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Word saved successfully!</span>
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
                intervalMinutes={reminderInterval}
                onChangeInterval={handleChangeInterval}
                secondsRemaining={secondsRemaining}
              />
            </div>
          </div>

          {/* ━━━ PANEL 2: SAVED WORDS ━━━ */}
          <div className="slide-panel">
            <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 pt-3 sm:pt-4 pb-6 sm:pb-8">
              <WordList
                words={words}
                onOpenQuiz={(word) => openQuizForWord(word)}
                onDeleteWord={handleDeleteWord}
                onDeleteBatch={handleDeleteBatch}
                onUpdateWord={handleUpdateWord}
                onRefreshWord={handleRefreshWord}
                refreshingWordId={refreshingWordId}
                refreshError={refreshError}
                onClearRefreshError={handleClearRefreshError}
                highlightedWordId={highlightedWordId}
              />
            </div>
          </div>

          {/* ━━━ PANEL 3: SETTINGS ━━━ */}
          <div className="slide-panel">
            <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 pt-3 sm:pt-4 pb-6 sm:pb-8">
              <SettingsTab
                totalWords={words.length}
                onRefreshWords={refreshWords}
                onStatusChange={handleBackupStatusChange}
                permission={permission}
                onRequestPermission={handleRequestPermission}
                isPersistent={isPersistent}
                isOnline={isOnline}
                backendStatus={backendStatus}
                storageStatus={storageStatus}
                reminderInterval={reminderInterval}
                onChangeInterval={handleChangeInterval}
                remindersActive={remindersActive}
                onStartReminders={handleStartReminders}
                onStopReminders={handleStopReminders}
                theme={theme}
                onToggleTheme={handleToggleTheme}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Modal Overlay */}
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
        onTabChange={(tab) => navigateToTab(TABS.indexOf(tab))}
        savedWordsCount={words.length}
      />
    </div>
  );
}

export default App;
