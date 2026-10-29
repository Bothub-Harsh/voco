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
import { generateVocabularyFromAI, checkBackendStatus } from './services/api';
import { generateFreshQuizSession } from './services/quizGenerator';
import {
  isRemindersActive,
  requestNotificationPermission,
  getNotificationPermission,
  pickNextReminderWord,
  dispatchWordNotification,
  getSavedReminderInterval,
  setSavedReminderInterval,
  getNextReminderTimestamp,
  setNextReminderTimestamp,
} from './services/notifications';
import { Header } from './components/Header';
import { StorageStatusIndicator } from './components/StorageStatusIndicator';
import { BackupControls } from './components/BackupControls';
import { AddWordForm } from './components/AddWordForm';
import { ReminderControls } from './components/ReminderControls';
import { WordList } from './components/WordList';
import { QuizScreen } from './components/QuizScreen';

export function App() {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [activeQuizSession, setActiveQuizSession] = useState<ActiveQuizSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedWord, setLastFailedWord] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [remindersActive, setRemindersActive] = useState<boolean>(isRemindersActive());
  const [reminderInterval, setReminderInterval] = useState<number>(getSavedReminderInterval());
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission()
  );
  const [isPersistent, setIsPersistent] = useState<boolean>(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    state: 'idle',
    message: 'Initializing local database...',
  });

  // Keep a ref to words so the reminder interval closure always has the latest words
  const wordsRef = useRef<VocabularyWord[]>(words);
  wordsRef.current = words;

  // Load words from IndexedDB (IndexedDB is the sole source of truth)
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
      const freshSession = generateFreshQuizSession(currentWord, wordsRef.current);
      setActiveQuizSession(freshSession);
    }
  }, []);

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

      // 4. Load from IndexedDB
      const loaded = await refreshWords();
      setStorageStatus({
        state: 'saved',
        message: `${loaded.length} word${loaded.length === 1 ? '' : 's'} loaded from IndexedDB`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      // 5. Check if quiz was requested via URL query param
      checkUrlForQuiz();
    };

    initializeStorage();

    // Check backend proxy status
    checkBackendStatus().then(setBackendStatus);

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
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

  // Handle active reminder timers and live second-by-second countdown
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
        // Time to trigger practice reminder!
        const words = wordsRef.current;
        const nextWord = pickNextReminderWord(words);
        if (nextWord) {
          dispatchWordNotification(nextWord, (w) => openQuizForWord(w));
        }

        // Schedule next reminder
        const newTarget = Date.now() + intervalMs;
        setNextReminderTimestamp(newTarget);
        setSecondsRemaining(reminderInterval * 60);
      }
    }, 1000);

    return () => clearInterval(ticker);
  }, [remindersActive, reminderInterval, openQuizForWord]);

  const handleChangeInterval = (newMinutes: number) => {
    const clamped = Math.max(1, Math.floor(newMinutes));
    setReminderInterval(clamped);
    setSavedReminderInterval(clamped);

    if (remindersActive) {
      // Reset countdown to the new interval immediately
      const newTarget = Date.now() + clamped * 60 * 1000;
      setNextReminderTimestamp(newTarget);
      setSecondsRemaining(clamped * 60);
    }
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
      await refreshWords();

      setStorageStatus({
        state: 'saved',
        message: `"${saved.word}" saved locally in IndexedDB`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      // 4. Open quiz for user to practice immediately with fresh randomized options
      openQuizForWord(saved);
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
      await refreshWords();

      setStorageStatus({
        state: 'saved',
        message: `"${saved.word}" saved locally in IndexedDB`,
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      // Open quiz for user to practice immediately with fresh randomized options
      openQuizForWord(saved);
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
      await refreshWords();
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

  const handleStartReminders = async () => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    if (granted) {
      const target = Date.now() + reminderInterval * 60 * 1000;
      setNextReminderTimestamp(target);
      setSecondsRemaining(reminderInterval * 60);
      setRemindersActive(true);
    } else {
      alert('Notification permission was not granted. Please allow notifications in your browser.');
    }
  };

  const handleStopReminders = () => {
    setRemindersActive(false);
    setSecondsRemaining(null);
    setNextReminderTimestamp(null);
  };

  const handleTestNotification = async () => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    if (!granted) {
      alert('Please enable browser notifications to test reminders.');
      return;
    }

    const nextWord = pickNextReminderWord(wordsRef.current);
    if (!nextWord) {
      alert('Save at least one word first before sending reminders.');
      return;
    }

    const sent = await dispatchWordNotification(nextWord, (w) => openQuizForWord(w));
    if (!sent) {
      alert('Could not deliver notification. Check your browser notification settings.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <Header
        isOnline={isOnline}
        backendStatus={backendStatus}
        savedWordsCount={words.length}
      />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        {/* Backend API Key Alert Banner if needed */}
        {backendStatus && !backendStatus.configured && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm">
            <p className="font-semibold text-amber-950">
              ⚡ Setup Required: Add your Groq API Key
            </p>
            <p className="text-xs text-amber-800 mt-1">
              To generate new words with Groq AI, open{' '}
              <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono text-amber-950">
                .env
              </code>{' '}
              in the project folder and paste your key into{' '}
              <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono text-amber-950">
                GROQ_API_KEY
              </code>
              . Saved words can still be quizzed offline anytime!
            </p>
          </div>
        )}

        {/* Visible IndexedDB Storage Status */}
        <StorageStatusIndicator
          status={storageStatus}
          isPersistent={isPersistent}
        />

        {/* 1. Add Word Form (AI Generation or Manual Meaning) */}
        <AddWordForm
          onAddWord={handleAddWord}
          onAddManualWord={handleAddManualWord}
          isLoading={isLoading}
          error={errorMessage}
          onRetry={handleRetry}
          lastFailedWord={lastFailedWord}
        />

        {/* 2. Backup & Restore Controls */}
        <BackupControls
          totalWords={words.length}
          onRefreshWords={refreshWords}
          onStatusChange={handleBackupStatusChange}
        />

        {/* 3. Practice Reminders Control with Time Adjustment & Live Countdown */}
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

        {/* 4. Saved Words List */}
        <WordList
          words={words}
          onOpenQuiz={(word) => openQuizForWord(word)}
          onDeleteWord={handleDeleteWord}
          onUpdateWord={handleUpdateWord}
        />
      </main>

      {/* Quiz Modal / Screen */}
      {activeQuizSession && (
        <QuizScreen
          quiz={activeQuizSession}
          onClose={() => setActiveQuizSession(null)}
          onTryAgain={() => handleTryAgainQuiz(activeQuizSession.wordId)}
        />
      )}

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <p>My Vocabulary &bull; Stored locally in IndexedDB &bull; Groq AI</p>
      </footer>
    </div>
  );
}

export default App;
