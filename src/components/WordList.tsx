import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Trash2,
  HelpCircle,
  Calendar,
  Sparkles,
  Edit3,
  RotateCw,
  AlertCircle,
  X,
  Search,
  Volume2,
  MoreVertical,
  CheckSquare,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Tag,
  FolderPlus,
  FolderMinus,
  GitMerge,
  RotateCcw,
  ChevronRight,
  ArrowLeft,
  Info,
} from 'lucide-react';
import type { VocabularyWord, WordSection } from '../types';
import {
  ALL_WORDS_SECTION_ID,
  DEFAULT_ALL_WORDS_SECTION,
  type MergeSectionResult,
  type DeleteSectionResult,
} from '../db/indexedDb';
import { EditWordModal } from './EditWordModal';
import { FormattedMeaning } from './FormattedMeaning';
import { speak, stopSpeech, isTtsAvailable } from '../services/tts';

interface WordListProps {
  words: VocabularyWord[];
  onOpenQuiz: (word: VocabularyWord) => void;
  onPracticeAll?: () => void;
  onCreateStory?: () => void;
  storyCooldownSeconds?: number;
  onDeleteWord: (id: string, word: string) => Promise<void>;
  onDeleteBatch?: (ids: string[]) => Promise<void>;
  onUpdateWord: (word: VocabularyWord) => Promise<void>;
  onRefreshWord: (word: VocabularyWord) => Promise<void>;
  refreshingWordId: string | null;
  refreshError: { wordId: string; message: string } | null;
  onClearRefreshError: (wordId: string) => void;
  highlightedWordId?: string | null;
  // Word Sections Props
  sections?: WordSection[];
  activeSectionId?: string;
  onSelectSection?: (id: string) => void;
  sectionWordCounts?: Record<string, number>;
  onCreateSection?: (name: string) => Promise<void>;
  onRenameSection?: (id: string, newName: string) => Promise<void>;
  onDeleteSection?: (id: string) => Promise<DeleteSectionResult>;
  onMergeSections?: (sourceId: string, targetId: string, deleteSource: boolean) => Promise<MergeSectionResult>;
  onUndoMerge?: (mergeResult: MergeSectionResult) => Promise<void>;
  onUndoDelete?: (deleteResult: DeleteSectionResult) => Promise<void>;
  onAddWordsToSection?: (wordIds: string[], sectionId: string) => Promise<void>;
  onRemoveWordsFromSection?: (wordIds: string[], sectionId: string) => Promise<void>;
  onManageWordSections?: (wordId: string, sectionIds: string[]) => Promise<void>;
  wordSectionMap?: Record<string, string[]>;
}

export const WordList: React.FC<WordListProps> = ({
  words,
  onOpenQuiz,
  onPracticeAll,
  onCreateStory,
  storyCooldownSeconds = 0,
  onDeleteWord,
  onDeleteBatch,
  onUpdateWord,
  onRefreshWord,
  refreshingWordId,
  refreshError,
  onClearRefreshError,
  highlightedWordId,
  sections = [DEFAULT_ALL_WORDS_SECTION],
  activeSectionId = ALL_WORDS_SECTION_ID,
  onSelectSection,
  sectionWordCounts = {},
  onCreateSection,
  onRenameSection,
  onDeleteSection,
  onMergeSections,
  onUndoMerge,
  onUndoDelete,
  onAddWordsToSection,
  onRemoveWordsFromSection,
  onManageWordSections,
  wordSectionMap = {},
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Section Modals & Popups State
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [manageSectionsWord, setManageSectionsWord] = useState<VocabularyWord | null>(null);
  const [manageSelectedSectionIds, setManageSelectedSectionIds] = useState<string[]>([]);
  const [showBatchAddModal, setShowBatchAddModal] = useState(false);
  const [batchTargetSectionId, setBatchTargetSectionId] = useState<string>('');

  // ─── Section Action Bottom Sheet State ───
  type SheetMode = 'options' | 'merge_select_target' | 'merge_confirm' | 'rename' | 'delete' | 'all_words_info';
  const [actionSheetSection, setActionSheetSection] = useState<WordSection | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>('options');
  const [mergeTargetSectionId, setMergeTargetSectionId] = useState<string>('');
  const [deleteSourceAfterMerge, setDeleteSourceAfterMerge] = useState<boolean>(false);
  const [renameInputName, setRenameInputName] = useState<string>('');
  const [actionSheetError, setActionSheetError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  // ─── Undo Toast State ───
  interface UndoToastState {
    type: 'merge' | 'delete';
    message: string;
    mergeResult?: MergeSectionResult;
    deleteResult?: DeleteSectionResult;
  }
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const undoToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ttsAvailable = isTtsAvailable();

  const userSections = useMemo(
    () => sections.filter((s) => s.id !== ALL_WORDS_SECTION_ID),
    [sections]
  );

  const activeSection = useMemo(
    () => sections.find((s) => s.id === activeSectionId) || DEFAULT_ALL_WORDS_SECTION,
    [sections, activeSectionId]
  );

  // Close Bottom Sheet on Escape key
  const closeActionSheet = useCallback(() => {
    setActionSheetSection(null);
    setSheetMode('options');
    setMergeTargetSectionId('');
    setDeleteSourceAfterMerge(false);
    setActionSheetError(null);
    setIsSubmittingAction(false);
  }, []);

  useEffect(() => {
    if (!actionSheetSection) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeActionSheet();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actionSheetSection, closeActionSheet]);

  // Undo Toast Timer Auto-Dismiss
  const showUndoToast = useCallback((toast: UndoToastState) => {
    if (undoToastTimerRef.current) {
      clearTimeout(undoToastTimerRef.current);
    }
    setUndoToast(toast);
    undoToastTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 8000);
  }, []);

  const handleDismissUndoToast = useCallback(() => {
    if (undoToastTimerRef.current) {
      clearTimeout(undoToastTimerRef.current);
      undoToastTimerRef.current = null;
    }
    setUndoToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (undoToastTimerRef.current) {
        clearTimeout(undoToastTimerRef.current);
      }
    };
  }, []);

  const handlePerformUndo = async () => {
    if (!undoToast) return;
    const currentToast = undoToast;
    handleDismissUndoToast();
    try {
      if (currentToast.type === 'merge' && currentToast.mergeResult && onUndoMerge) {
        await onUndoMerge(currentToast.mergeResult);
      } else if (currentToast.type === 'delete' && currentToast.deleteResult && onUndoDelete) {
        await onUndoDelete(currentToast.deleteResult);
      }
    } catch (err) {
      alert('Could not undo action: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Lock body scrolling when any modal is active
  useEffect(() => {
    const isAnyModalOpen =
      showDeleteConfirm ||
      showCreateSectionModal ||
      Boolean(actionSheetSection) ||
      Boolean(manageSectionsWord) ||
      showBatchAddModal;

    if (!isAnyModalOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [
    showDeleteConfirm,
    showCreateSectionModal,
    actionSheetSection,
    manageSectionsWord,
    showBatchAddModal,
  ]);

  const handleSpeak = useCallback(async (word: VocabularyWord) => {
    if (speakingId === word.id) {
      await stopSpeech();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(word.id);
    try {
      await speak(word.word);
    } finally {
      setTimeout(() => setSpeakingId(null), 2500);
    }
  }, [speakingId]);

  // Filter words by active section first
  const sectionWords = useMemo(() => {
    if (!activeSectionId || activeSectionId === ALL_WORDS_SECTION_ID) {
      return words;
    }
    return words.filter((w) => {
      const secIds = wordSectionMap[w.id] || [];
      return secIds.includes(activeSectionId);
    });
  }, [words, activeSectionId, wordSectionMap]);

  // Filter by search query within the selected section
  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) return sectionWords;
    const q = searchQuery.toLowerCase().trim();
    return sectionWords.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.hindiMeaning && w.hindiMeaning.toLowerCase().includes(q))
    );
  }, [sectionWords, searchQuery]);

  const handleDeleteClick = async (word: VocabularyWord) => {
    if (window.confirm(`Are you sure you want to delete "${word.word}" from your vocabulary?`)) {
      setDeletingId(word.id);
      try {
        await onDeleteWord(word.id, word.word);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(word.id);
          return next;
        });
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setIsSelectionMode(true);
    if (selectedIds.size === filteredWords.length && selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWords.map((w) => w.id)));
    }
  };

  const handleCancelSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleDeleteSelectedClick = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one word to delete.');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleConfirmBatchDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    setIsDeletingBatch(true);
    try {
      if (onDeleteBatch) {
        await onDeleteBatch(idsToDelete);
      } else {
        for (const id of idsToDelete) {
          const wordObj = words.find((w) => w.id === id);
          await onDeleteWord(id, wordObj?.word || '');
        }
      }
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      alert('Failed to delete selected words: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // ─── Section CRUD Handlers ───
  const handleOpenCreateSection = () => {
    setNewSectionName('');
    setSectionError(null);
    setShowCreateSectionModal(true);
  };

  const handleCreateSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSectionName.trim();
    if (!trimmed) {
      setSectionError('Section name cannot be empty.');
      return;
    }
    if (trimmed.length > 30) {
      setSectionError('Section name cannot exceed 30 characters.');
      return;
    }
    try {
      if (onCreateSection) {
        await onCreateSection(trimmed);
      }
      setShowCreateSectionModal(false);
      setNewSectionName('');
      setSectionError(null);
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : 'Failed to create section.');
    }
  };

  const openSectionActionSheet = (sec: WordSection) => {
    setActionSheetSection(sec);
    setSheetMode('options');
    setMergeTargetSectionId('');
    setDeleteSourceAfterMerge(false);
    setRenameInputName(sec.name);
    setActionSheetError(null);
    setIsSubmittingAction(false);
  };

  const openAllWordsInfoSheet = () => {
    setActionSheetSection(DEFAULT_ALL_WORDS_SECTION);
    setSheetMode('all_words_info');
    setActionSheetError(null);
    setIsSubmittingAction(false);
  };

  const handlePerformRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!actionSheetSection) return;
    const trimmed = renameInputName.trim();
    if (!trimmed) {
      setActionSheetError('Section name cannot be empty.');
      return;
    }
    if (trimmed.length > 30) {
      setActionSheetError('Section name cannot exceed 30 characters.');
      return;
    }
    const duplicate = sections.some(
      (s) => s.id !== actionSheetSection.id && s.nameLower === trimmed.toLowerCase()
    );
    if (duplicate) {
      setActionSheetError('A section with this name already exists.');
      return;
    }
    setIsSubmittingAction(true);
    setActionSheetError(null);
    try {
      if (onRenameSection) {
        await onRenameSection(actionSheetSection.id, trimmed);
      }
      closeActionSheet();
    } catch (err) {
      setActionSheetError(err instanceof Error ? err.message : 'Failed to rename section.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handlePerformMerge = async () => {
    if (!actionSheetSection || !mergeTargetSectionId) return;
    setIsSubmittingAction(true);
    setActionSheetError(null);
    try {
      if (onMergeSections) {
        const result = await onMergeSections(
          actionSheetSection.id,
          mergeTargetSectionId,
          deleteSourceAfterMerge
        );
        closeActionSheet();
        showUndoToast({
          type: 'merge',
          message: `Merged ${result.wordsMovedCount} word${result.wordsMovedCount === 1 ? '' : 's'} into "${result.targetSection.name}"`,
          mergeResult: result,
        });
      }
    } catch (err) {
      setActionSheetError(err instanceof Error ? err.message : 'Failed to merge sections.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handlePerformDelete = async () => {
    if (!actionSheetSection) return;
    setIsSubmittingAction(true);
    setActionSheetError(null);
    try {
      if (onDeleteSection) {
        const result = await onDeleteSection(actionSheetSection.id);
        if (activeSectionId === actionSheetSection.id && onSelectSection) {
          onSelectSection(ALL_WORDS_SECTION_ID);
        }
        closeActionSheet();
        showUndoToast({
          type: 'delete',
          message: `Deleted section "${result.deletedSection.name}"`,
          deleteResult: result,
        });
      }
    } catch (err) {
      setActionSheetError(err instanceof Error ? err.message : 'Failed to delete section.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Manage Word Sections Modal
  const handleOpenManageSections = (word: VocabularyWord) => {
    setManageSectionsWord(word);
    const currentSecIds = wordSectionMap[word.id] || [];
    setManageSelectedSectionIds(currentSecIds.filter((id) => id !== ALL_WORDS_SECTION_ID));
  };

  const handleToggleSectionForWord = (secId: string) => {
    setManageSelectedSectionIds((prev) =>
      prev.includes(secId) ? prev.filter((id) => id !== secId) : [...prev, secId]
    );
  };

  const handleSaveWordSections = async () => {
    if (!manageSectionsWord) return;
    try {
      if (onManageWordSections) {
        await onManageWordSections(manageSectionsWord.id, manageSelectedSectionIds);
      }
      setManageSectionsWord(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update sections.');
    }
  };

  // Batch Add to Section
  const handleConfirmBatchAdd = async () => {
    if (!batchTargetSectionId || selectedIds.size === 0) return;
    try {
      if (onAddWordsToSection) {
        await onAddWordsToSection(Array.from(selectedIds), batchTargetSectionId);
      }
      setShowBatchAddModal(false);
      setBatchTargetSectionId('');
      handleCancelSelection();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add words to section.');
    }
  };

  // Batch Remove from active Section
  const handleBatchRemoveFromCurrentSection = async () => {
    if (activeSectionId === ALL_WORDS_SECTION_ID || selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Remove ${selectedIds.size} word${selectedIds.size === 1 ? '' : 's'} from "${activeSection.name}"? Words will remain saved in All Words.`
    );
    if (!confirmed) return;

    try {
      if (onRemoveWordsFromSection) {
        await onRemoveWordsFromSection(Array.from(selectedIds), activeSectionId);
      }
      handleCancelSelection();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove words from section.');
    }
  };

  if (words.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <div className="bg-white dark:bg-[#1B1D25] rounded-2xl shadow-card border border-slate-200/90 dark:border-[#30333E] p-10 text-center transition-colors">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-[#6554F5]/30">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 mb-1.5">
            No words saved yet
          </h3>
          <p className="text-sm text-slate-400 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Go to the <strong className="text-slate-600 dark:text-zinc-300">Add Words</strong> tab to start building your vocabulary.
          </p>
        </div>
      </div>
    );
  }

  const isSelectionActive = isSelectionMode || selectedIds.size > 0;

  return (
    <div className="space-y-3 animate-fade-in-up relative">
      {/* ━━ Sticky Top Selection Toolbar (pinned at TOP while scrolling) ━━ */}
      {isSelectionActive && (
        <div className="sticky top-0 z-30 bg-[#F8FAFC]/95 dark:bg-[#121318]/95 backdrop-blur-md py-2 px-3 rounded-2xl border border-indigo-200/90 dark:border-[#8875F5]/30 shadow-md flex items-center justify-between gap-1.5 animate-fade-in-up flex-wrap">
          <div className="flex items-center space-x-2 min-w-0">
            <button
              type="button"
              onClick={handleCancelSelection}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors shrink-0"
              title="Cancel selection"
              aria-label="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs text-indigo-950 dark:text-zinc-100 truncate">
              {selectedIds.size} {selectedIds.size === 1 ? 'word' : 'words'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2 py-1 text-xs font-semibold text-[#6554F5] dark:text-[#8172F8] hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {selectedIds.size === filteredWords.length && selectedIds.size > 0 ? 'Deselect All' : 'Select All'}
            </button>

            {/* Add to section button */}
            <button
              type="button"
              onClick={() => {
                if (selectedIds.size === 0) return;
                setBatchTargetSectionId(userSections[0]?.id || '');
                setShowBatchAddModal(true);
              }}
              disabled={selectedIds.size === 0 || userSections.length === 0}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-[#6554F5]/15 hover:bg-indigo-100 dark:hover:bg-[#6554F5]/25 text-[#6554F5] dark:text-[#8875F5] disabled:opacity-40 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-[#6554F5]/30 transition-all"
              title={userSections.length === 0 ? 'Create a section first' : 'Add selected words to a section'}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add to section</span>
            </button>

            {/* Remove from section button (only when viewing a specific section) */}
            {activeSectionId !== ALL_WORDS_SECTION_ID && (
              <button
                type="button"
                onClick={handleBatchRemoveFromCurrentSection}
                disabled={selectedIds.size === 0}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 disabled:opacity-40 rounded-xl text-xs font-semibold border border-amber-200 dark:border-amber-800 transition-all"
                title="Remove selected words from this section"
              >
                <FolderMinus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDeleteSelectedClick}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* ━━ Section Chips (Horizontally Scrollable) ━━ */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
        {/* All Words Chip */}
        <button
          type="button"
          onClick={() => onSelectSection && onSelectSection(ALL_WORDS_SECTION_ID)}
          className={`shrink-0 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
            activeSectionId === ALL_WORDS_SECTION_ID
              ? 'bg-[#6554F5] text-white border-[#6554F5] shadow-xs'
              : 'bg-white dark:bg-[#1B1D25] text-slate-700 dark:text-zinc-300 border-slate-200/90 dark:border-[#30333E] hover:border-slate-300 dark:hover:border-zinc-700'
          }`}
        >
          <span>All Words</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
              activeSectionId === ALL_WORDS_SECTION_ID
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
            }`}
          >
            {words.length}
          </span>
        </button>

        {/* User Sections Chips */}
        {userSections.map((sec) => {
          const isActive = activeSectionId === sec.id;
          const count = sectionWordCounts[sec.id] || 0;
          return (
            <div
              key={sec.id}
              className={`shrink-0 inline-flex items-center rounded-full text-xs font-bold transition-all border pl-3 pr-1 py-0.5 ${
                isActive
                  ? 'bg-[#6554F5] text-white border-[#6554F5] shadow-xs'
                  : 'bg-white dark:bg-[#1B1D25] text-slate-700 dark:text-zinc-300 border-slate-200/90 dark:border-[#30333E] hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--voco-accent, #6554F5)' : undefined,
                borderColor: isActive ? 'var(--voco-accent, #6554F5)' : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => onSelectSection && onSelectSection(sec.id)}
                className="inline-flex items-center space-x-1.5 py-1 cursor-pointer focus:outline-none"
              >
                <span className="truncate max-w-[120px]">{sec.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>

              {/* Three-Dot Menu Button on Chip */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  openSectionActionSheet(sec);
                }}
                className={`ml-1 w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer relative before:absolute before:-inset-1.5 ${
                  isActive
                    ? 'text-white/80 hover:text-white hover:bg-white/20 active:bg-white/30'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 active:bg-slate-200 dark:active:bg-zinc-700'
                }`}
                title={`Manage "${sec.name}"`}
                aria-label={`Manage "${sec.name}"`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Add Section Button */}
        <button
          type="button"
          onClick={handleOpenCreateSection}
          className="shrink-0 inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50/70 dark:bg-[#6554F5]/10 text-[#6554F5] dark:text-[#8875F5] border border-dashed border-indigo-200 dark:border-[#6554F5]/30 hover:bg-indigo-100/70 dark:hover:bg-[#6554F5]/20 transition-colors"
          title="Create a new word section"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Section</span>
        </button>
      </div>

      {/* Section header with count and Three-Dot Menu */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            {activeSection.name}
            <span className="ml-2 text-xs font-semibold text-slate-400 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 px-2 py-0.5 rounded-full">
              {sectionWords.length}
            </span>
          </h2>
          {filteredWords.length !== sectionWords.length && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-400 font-medium">
              Showing {filteredWords.length} of {sectionWords.length}
            </span>
          )}
        </div>

        {/* Three-Dot Menu Button */}
        <button
          type="button"
          onClick={() => {
            if (activeSection.id === ALL_WORDS_SECTION_ID) {
              openAllWordsInfoSheet();
            } else {
              openSectionActionSheet(activeSection);
            }
          }}
          className="w-8 h-8 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl border border-slate-200/90 dark:border-[#30333E] bg-white dark:bg-[#222530] text-slate-500 dark:text-[#A5A8B5] hover:text-slate-800 dark:hover:text-[#F1F1F5] hover:bg-slate-50 dark:hover:bg-[#2A2E3C] transition-colors shadow-xs cursor-pointer"
          style={{
            backgroundColor: 'var(--voco-bg-card, #FFFFFF)',
            borderColor: 'var(--voco-border, #CBD5E1)',
            color: 'var(--voco-text-secondary, #334155)',
          }}
          title={activeSection.id === ALL_WORDS_SECTION_ID ? 'All Words options' : `Manage "${activeSection.name}"`}
          aria-label={activeSection.id === ALL_WORDS_SECTION_ID ? 'All Words options' : `Manage "${activeSection.name}"`}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${activeSection.name}...`}
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#1B1D25] hover:border-slate-400 dark:hover:border-[#4F5568] focus:bg-white focus:dark:bg-[#1B1D25] focus:outline-none focus:ring-2 focus:ring-[#8875F5]/30 focus:border-[#8875F5] dark:focus:border-[#8875F5] transition-all text-slate-800 dark:text-[#F1F1F5] placeholder:text-slate-400 dark:placeholder:text-[#6B6E80] shadow-xs"
          autoComplete="off"
          spellCheck="false"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* No search results */}
      {filteredWords.length === 0 && searchQuery.trim() && (
        <div className="bg-white dark:bg-[#1B1D25] rounded-2xl shadow-card border border-slate-300 dark:border-[#3E4452] p-8 text-center transition-colors">
          <Search className="w-8 h-8 text-slate-300 dark:text-zinc-500 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">
            No words matching &ldquo;{searchQuery}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-[#6554F5] dark:text-[#6554F5] hover:underline font-semibold"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Empty section state */}
      {filteredWords.length === 0 && !searchQuery.trim() && (
        <div className="bg-white dark:bg-[#1B1D25] rounded-2xl shadow-card border border-slate-300 dark:border-[#3E4452] p-8 text-center transition-colors">
          <FolderPlus className="w-8 h-8 text-slate-300 dark:text-zinc-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-1">
            No words in &ldquo;{activeSection.name}&rdquo;
          </h3>
          <p className="text-xs text-slate-400 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Add words from the Add Words tab or select words from &ldquo;All Words&rdquo; to add them to this section.
          </p>
        </div>
      )}

      {/* ━━ Practice Section Words Button ━━ */}
      {sectionWords.length > 0 && !isSelectionActive && onPracticeAll && (
        <div className="pt-0.5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onPracticeAll}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-[#6554F5] to-[#7B68EE] hover:from-[#5443E8] hover:to-[#6A57DC] active:from-[#4736D7] active:to-[#5946CB] text-white rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center space-x-2 border border-indigo-400/30"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>
              Practice {activeSectionId === ALL_WORDS_SECTION_ID ? 'All Words' : activeSection.name} ({sectionWords.length})
            </span>
          </button>
          {onCreateStory && words.length >= 2 && (
            storyCooldownSeconds > 0 ? (
              <button
                type="button"
                disabled={true}
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-[#1A1C24] border border-slate-300 dark:border-[#3E4452] text-slate-500 dark:text-[#A5A8B5] rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm cursor-not-allowed opacity-80 flex items-center justify-center space-x-2"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Create another story in{' '}
                  {`${Math.floor(storyCooldownSeconds / 60)
                    .toString()
                    .padStart(2, '0')}:${(storyCooldownSeconds % 60)
                    .toString()
                    .padStart(2, '0')}`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onCreateStory}
                className="w-full py-2.5 px-4 bg-white dark:bg-[#1B1D25] border-2 border-[#6554F5]/50 dark:border-[#8875F5]/40 hover:border-[#6554F5] dark:hover:border-[#8875F5] hover:bg-indigo-50/50 dark:hover:bg-[#252834] text-[#6554F5] dark:text-[#8875F5] rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2"
              >
                <span>📖</span>
                <span>Create Story</span>
              </button>
            )
          )}
        </div>
      )}

      {/* Word cards */}
      <div className="grid gap-3">
        {filteredWords.map((item, index) => {
          const dateStr = new Date(item.dateAdded).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });
          const isRefreshing = refreshingWordId === item.id;
          const isHighlighted = highlightedWordId === item.id;
          const hasError = refreshError && refreshError.wordId === item.id;
          const isSelected = selectedIds.has(item.id);
          const itemSectionIds = wordSectionMap[item.id] || [];
          const itemSections = userSections.filter((s) => itemSectionIds.includes(s.id));

          return (
            <div
              key={item.id}
              onClick={() => {
                if (isSelectionActive) {
                  toggleSelect(item.id);
                }
              }}
              className={`bg-white dark:bg-[#1B1D25] border rounded-2xl p-4 sm:p-5 transition-all shadow-card hover:shadow-card-hover animate-fade-in-up relative ${
                isSelectionActive ? 'cursor-pointer' : ''
              } ${
                isSelected
                  ? 'border-[#8875F5] dark:border-[#8875F5] ring-2 ring-[#8875F5]/30 shadow-md'
                  : isHighlighted
                    ? 'border-indigo-400 dark:border-[#8875F5] ring-2 ring-indigo-200 dark:ring-[#8875F5]/25 shadow-md'
                    : 'border-slate-300 dark:border-[#3E4452] hover:border-slate-400 dark:hover:border-[#4F5568]'
              }`}
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              {/* Top row: Checkbox + Word + Single Speaker + Badges + Actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center flex-wrap gap-2 min-w-0">
                  {/* Select Checkbox Indicator */}
                  {isSelectionActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className="p-0.5 text-slate-400 hover:text-[#6554F5] transition-colors shrink-0"
                      aria-label={isSelected ? `Deselect ${item.word}` : `Select ${item.word}`}
                    >
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-[#6554F5] fill-indigo-100 dark:fill-[#6554F5]/20" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-zinc-700 hover:border-[#6554F5] transition-colors" />
                      )}
                    </button>
                  )}

                  {/* Word Title */}
                  <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 capitalize tracking-tight leading-tight">
                    {item.word.replace(/\*+/g, '')}
                  </h3>

                  {/* Exactly ONE speaker icon beside word title */}
                  {ttsAvailable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(item);
                      }}
                      className={`p-1 rounded-full transition-all ${
                        speakingId === item.id
                          ? 'text-[#6554F5] bg-indigo-50 dark:bg-[#6554F5]/15 animate-pulse'
                          : 'text-slate-400 dark:text-zinc-500 hover:text-[#6554F5] dark:hover:text-[#6554F5] hover:bg-indigo-50 dark:hover:bg-zinc-900'
                      }`}
                      title={speakingId === item.id ? 'Speaking…' : `Pronounce "${item.word}"`}
                      aria-label={`Pronounce ${item.word}`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}

                  <span className="inline-flex items-center text-[10px] text-slate-400 dark:text-zinc-400 font-medium">
                    <Calendar className="w-3 h-3 mr-0.5" />
                    {dateStr}
                  </span>
                  {item.isCustomMeaning && (
                    <span className="text-[9px] font-bold bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] px-1.5 py-0.5 rounded-md border border-indigo-100 dark:border-[#6554F5]/30">
                      MY MEANING
                    </span>
                  )}
                  {isHighlighted && (
                    <span className="text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-[#28C995] px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-[#28C995]/40 animate-pulse">
                      JUST ADDED
                    </span>
                  )}

                  {/* Section badges for this word */}
                  {itemSections.map((sec) => (
                    <span
                      key={sec.id}
                      className="text-[9px] font-bold bg-indigo-50 dark:bg-[#6554F5]/15 text-[#6554F5] dark:text-[#8875F5] px-1.5 py-0.5 rounded-md border border-indigo-100 dark:border-[#6554F5]/30"
                    >
                      {sec.name}
                    </span>
                  ))}
                </div>

                {/* Action buttons: Practice, Manage Sections, Edit, Delete */}
                <div
                  className="flex items-center space-x-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onOpenQuiz(item)}
                    className="inline-flex items-center px-2.5 py-1.5 bg-indigo-50 dark:bg-[#6554F5]/15 hover:bg-[#6554F5] dark:hover:bg-[#6554F5] text-[#6554F5] dark:text-[#8172F8] hover:text-white dark:hover:text-white border border-indigo-100 dark:border-[#6554F5]/30 rounded-lg text-[11px] font-semibold transition-all"
                    title={`Practice quiz for ${item.word}`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1" />
                    Practice
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenManageSections(item)}
                    className="p-1.5 text-slate-400 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-[#6554F5] hover:bg-indigo-50 dark:hover:bg-zinc-900 border border-transparent hover:border-slate-200 dark:hover:border-zinc-800 rounded-lg transition-colors"
                    title={`Manage sections for "${item.word}"`}
                    aria-label={`Manage sections for "${item.word}"`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingWord(item)}
                    className="p-1.5 text-slate-400 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-[#6554F5] hover:bg-indigo-50 dark:hover:bg-zinc-900 border border-transparent hover:border-slate-200 dark:hover:border-zinc-800 rounded-lg transition-colors"
                    title={`Edit ${item.word}`}
                    aria-label={`Edit ${item.word}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(item)}
                    disabled={deletingId === item.id}
                    className="p-1.5 text-slate-400 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40 rounded-lg transition-colors disabled:opacity-40"
                    title={`Delete ${item.word}`}
                    aria-label={`Delete ${item.word}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ━━ Bilingual Meanings & Example container (Vertical Stack) ━━ */}
              <div
                className="mt-3 bg-slate-50/80 dark:bg-[#15171E] rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-[#3E4452] space-y-3"
                onClick={(e) => {
                  if (isSelectionActive) e.stopPropagation();
                }}
              >
                {/* 1. English Meaning with Selective Bold Keyword Emphasis */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-[#A5A8B5] tracking-wider uppercase">
                      MEANING (ENGLISH)
                    </span>
                    <button
                      type="button"
                      onClick={() => onRefreshWord(item)}
                      disabled={isRefreshing || refreshingWordId !== null}
                      className="inline-flex items-center space-x-1 text-[10px] font-semibold text-[#8875F5] dark:text-[#8875F5] hover:text-indigo-700 dark:hover:text-white bg-white dark:bg-[#2A2E3C] hover:bg-indigo-50 dark:hover:bg-[#3E4452] border border-slate-300 dark:border-[#3E4452] px-2 py-1 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate fresh English & Hindi definitions"
                    >
                      <RotateCw
                        className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
                      />
                      <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-[#F1F1F5] leading-relaxed">
                    <FormattedMeaning text={item.meaning} />
                  </p>
                </div>

                {/* 2. Hindi Meaning (Vertically below English meaning) */}
                {item.hindiMeaning ? (
                  <div className="pt-2.5 border-t border-slate-200 dark:border-[#2E3341]">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-[#A5A8B5] tracking-wider uppercase block mb-1">
                      अर्थ (HINDI)
                    </span>
                    <p className="text-sm text-slate-700 dark:text-[#F1F1F5] leading-relaxed font-normal">
                      <FormattedMeaning text={item.hindiMeaning} />
                    </p>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200 dark:border-[#2E3341] flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400 dark:text-[#6B6E80] italic">
                      No Hindi translation yet
                    </span>
                    <button
                      type="button"
                      onClick={() => onRefreshWord(item)}
                      disabled={isRefreshing}
                      className="text-[10px] font-semibold text-[#8875F5] hover:underline"
                    >
                      Generate Hindi
                    </button>
                  </div>
                )}

                {/* 3. English Example (Strictly English only, in normal italic text) */}
                <div className="pt-2.5 border-t border-slate-200 dark:border-[#2E3341]">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-[#A5A8B5] tracking-wider uppercase block mb-1">
                    EXAMPLE
                  </span>
                  <p className="text-sm text-slate-500 dark:text-[#A5A8B5] italic leading-relaxed">
                    &ldquo;<FormattedMeaning text={item.example} />&rdquo;
                  </p>
                </div>
              </div>

              {/* Refresh error */}
              {hasError && (
                <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Refresh failed: </span>
                      <span>{refreshError.message}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClearRefreshError(item.id)}
                    className="text-rose-400 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-200 p-0.5 rounded shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Word Modal */}
      {editingWord && (
        <EditWordModal
          word={editingWord}
          onClose={() => setEditingWord(null)}
          onSave={onUpdateWord}
        />
      )}

      {/* Create Section Modal */}
      {showCreateSectionModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-colors overflow-hidden"
          >
            <div className="bg-white dark:bg-[#1B1D25] w-full max-w-sm rounded-2xl shadow-elevated border border-slate-200/90 dark:border-[#30333E] p-6 relative transition-colors animate-fade-in-up">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1.5">
                New Section
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Organize your vocabulary into custom groups (e.g., Exam Words, Office, Daily Chat).
              </p>

              <form onSubmit={handleCreateSectionSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => {
                      setNewSectionName(e.target.value);
                      setSectionError(null);
                    }}
                    placeholder="Section name (max 30 chars)"
                    maxLength={30}
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#121318] text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#8875F5]/30 focus:border-[#8875F5]"
                  />
                  {sectionError && (
                    <p className="text-xs text-rose-500 font-semibold mt-1.5">{sectionError}</p>
                  )}
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateSectionModal(false);
                      setSectionError(null);
                    }}
                    className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-[#6554F5] hover:bg-[#5443E8] text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ━━ Section Actions / Info Bottom Sheet ━━ */}
      {actionSheetSection &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-end justify-center transition-colors overflow-hidden"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={closeActionSheet}
            />

            {/* Bottom Sheet Container */}
            <div
              className="relative w-full max-w-lg rounded-t-3xl shadow-elevated p-5 pb-8 z-10 transition-transform animate-slide-up max-h-[85vh] overflow-y-auto border-t border-x"
              style={{
                backgroundColor: 'var(--voco-bg-card, #FFFFFF)',
                borderColor: 'var(--voco-border, #CBD5E1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle Bar */}
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-700 mx-auto mb-4 shrink-0" />

              {/* ── MODE: OPTIONS ── */}
              {sheetMode === 'options' && (
                <div>
                  <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center space-x-2">
                        <h3
                          className="text-base font-bold truncate"
                          style={{ color: 'var(--voco-text-primary, #0F172A)' }}
                        >
                          {actionSheetSection.name}
                        </h3>
                        <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                          {sectionWordCounts[actionSheetSection.id] || 0}{' '}
                          {(sectionWordCounts[actionSheetSection.id] || 0) === 1 ? 'word' : 'words'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-zinc-400 mt-0.5">
                        Section settings & actions
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeActionSheet}
                      className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-1 pt-1">
                    {/* Merge Action */}
                    {(() => {
                      const otherSections = userSections.filter((s) => s.id !== actionSheetSection.id);
                      const canMerge = otherSections.length > 0;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (canMerge) {
                              setSheetMode('merge_select_target');
                              setActionSheetError(null);
                            }
                          }}
                          disabled={!canMerge}
                          className={`w-full min-h-[52px] px-3.5 py-3 rounded-2xl flex items-center justify-between text-left transition-colors ${
                            canMerge
                              ? 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 cursor-pointer active:scale-[0.99]'
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center space-x-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-[#6554F5] dark:text-[#8875F5] flex items-center justify-center shrink-0">
                              <GitMerge className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-sm font-semibold leading-snug"
                                style={{ color: 'var(--voco-text-primary, #0F172A)' }}
                              >
                                Merge into another section...
                              </p>
                              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                {canMerge
                                  ? 'Combine words into another section'
                                  : 'Requires at least 2 custom sections'}
                              </p>
                            </div>
                          </div>
                          {canMerge && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                        </button>
                      );
                    })()}

                    {/* Rename Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setRenameInputName(actionSheetSection.name);
                        setSheetMode('rename');
                        setActionSheetError(null);
                      }}
                      className="w-full min-h-[52px] px-3.5 py-3 rounded-2xl flex items-center justify-between text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60 cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                          <Edit3 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold leading-snug"
                            style={{ color: 'var(--voco-text-primary, #0F172A)' }}
                          >
                            Rename Section
                          </p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            Change section name
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>

                    {/* Delete Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setSheetMode('delete');
                        setActionSheetError(null);
                      }}
                      className="w-full min-h-[52px] px-3.5 py-3 rounded-2xl flex items-center justify-between text-left transition-colors hover:bg-rose-50/70 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center shrink-0">
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 leading-snug">
                            Delete Section
                          </p>
                          <p className="text-xs text-rose-500/80 dark:text-rose-400/80 mt-0.5">
                            Words remain safely in All Words
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── MODE: MERGE SELECT TARGET ── */}
              {sheetMode === 'merge_select_target' && (
                <div>
                  <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center space-x-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSheetMode('options')}
                        className="p-1.5 -ml-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                        aria-label="Back"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="min-w-0">
                        <h3
                          className="text-base font-bold truncate"
                          style={{ color: 'var(--voco-text-primary, #0F172A)' }}
                        >
                          Merge &ldquo;{actionSheetSection.name}&rdquo;
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-zinc-400">
                          Select the target section to receive these words
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeActionSheet}
                      className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pt-1">
                    {userSections
                      .filter((s) => s.id !== actionSheetSection.id)
                      .map((sec) => (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            setMergeTargetSectionId(sec.id);
                            setSheetMode('merge_confirm');
                          }}
                          className="w-full min-h-[50px] px-4 py-3 rounded-2xl flex items-center justify-between text-left transition-all border border-slate-200/80 dark:border-[#30333E] hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60 cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <span
                              className="font-bold text-sm truncate"
                              style={{ color: 'var(--voco-text-primary, #0F172A)' }}
                            >
                              {sec.name}
                            </span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 shrink-0">
                              {sectionWordCounts[sec.id] || 0} words
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* ── MODE: MERGE CONFIRM ── */}
              {sheetMode === 'merge_confirm' && (() => {
                const targetSec = sections.find((s) => s.id === mergeTargetSectionId);
                const sourceCount = sectionWordCounts[actionSheetSection.id] || 0;
                const targetCount = targetSec ? (sectionWordCounts[targetSec.id] || 0) : 0;

                return (
                  <div>
                    <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center space-x-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => setSheetMode('merge_select_target')}
                          className="p-1.5 -ml-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          aria-label="Back"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h3
                          className="text-base font-bold truncate"
                          style={{ color: 'var(--voco-text-primary, #0F172A)' }}
                        >
                          Confirm Merge
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={closeActionSheet}
                        className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Visual Merge Diagram */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-[#30333E] mb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Source</span>
                          <span className="font-bold text-sm text-slate-800 dark:text-zinc-100 truncate block">
                            {actionSheetSection.name}
                          </span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300">
                          {sourceCount} words
                        </span>
                      </div>

                      <div className="flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-[#6554F5] dark:text-[#8875F5] flex items-center justify-center border border-indigo-200 dark:border-indigo-900/40">
                          <GitMerge className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Target</span>
                          <span className="font-bold text-sm text-slate-800 dark:text-zinc-100 truncate block">
                            {targetSec?.name || 'Target Section'}
                          </span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300">
                          {targetCount} words
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 leading-relaxed">
                      All words from &ldquo;<strong className="text-slate-800 dark:text-zinc-200">{actionSheetSection.name}</strong>&rdquo; will be added to &ldquo;<strong className="text-slate-800 dark:text-zinc-200">{targetSec?.name}</strong>&rdquo;. Words already in the target section will not be duplicated.
                    </p>

                    {/* Toggle: Delete Source After Merging */}
                    <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#30333E] hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 cursor-pointer mb-5 transition-colors">
                      <div className="min-w-0 pr-3">
                        <p className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                          Delete &ldquo;{actionSheetSection.name}&rdquo; after merge
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-400 mt-0.5">
                          Removes this section once merged. Words stay safe in All Words.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={deleteSourceAfterMerge}
                        onChange={(e) => setDeleteSourceAfterMerge(e.target.checked)}
                        className="w-5 h-5 rounded text-[#6554F5] focus:ring-[#8875F5] border-slate-300 dark:border-zinc-700 cursor-pointer shrink-0"
                      />
                    </label>

                    {actionSheetError && (
                      <p className="text-xs text-rose-500 font-semibold mb-3">{actionSheetError}</p>
                    )}

                    {/* Action Buttons (min 44px height) */}
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSheetMode('merge_select_target')}
                        className="flex-1 min-h-[44px] py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handlePerformMerge}
                        disabled={isSubmittingAction}
                        className="flex-1 min-h-[44px] py-2.5 px-4 bg-[#6554F5] hover:bg-[#5443E8] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                        style={{
                          backgroundColor: 'var(--voco-accent, #6554F5)',
                        }}
                      >
                        <GitMerge className="w-4 h-4" />
                        <span>{isSubmittingAction ? 'Merging...' : 'Merge Sections'}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── MODE: RENAME ── */}
              {sheetMode === 'rename' && (
                <div>
                  <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center space-x-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSheetMode('options')}
                        className="p-1.5 -ml-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                        aria-label="Back"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h3
                        className="text-base font-bold truncate"
                        style={{ color: 'var(--voco-text-primary, #0F172A)' }}
                      >
                        Rename Section
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={closeActionSheet}
                      className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handlePerformRename} className="space-y-4 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 block mb-1.5">
                        Section Name
                      </label>
                      <input
                        type="text"
                        value={renameInputName}
                        onChange={(e) => {
                          setRenameInputName(e.target.value);
                          setActionSheetError(null);
                        }}
                        placeholder="New section name"
                        maxLength={30}
                        autoFocus
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-[#3E4452] bg-white dark:bg-[#121318] text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#8875F5]/30 focus:border-[#8875F5]"
                      />
                      {actionSheetError && (
                        <p className="text-xs text-rose-500 font-semibold mt-1.5">{actionSheetError}</p>
                      )}
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setSheetMode('options')}
                        className="flex-1 min-h-[44px] py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingAction}
                        className="flex-1 min-h-[44px] py-2.5 px-4 bg-[#6554F5] hover:bg-[#5443E8] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center"
                        style={{
                          backgroundColor: 'var(--voco-accent, #6554F5)',
                        }}
                      >
                        {isSubmittingAction ? 'Saving...' : 'Save Name'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── MODE: DELETE ── */}
              {sheetMode === 'delete' && (
                <div>
                  <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center space-x-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSheetMode('options')}
                        className="p-1.5 -ml-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                        aria-label="Back"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 truncate">
                        Delete Section?
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={closeActionSheet}
                      className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="text-center py-2 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/40">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                      Delete &ldquo;{actionSheetSection.name}&rdquo;?
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                      All <strong className="text-slate-700 dark:text-zinc-200">{sectionWordCounts[actionSheetSection.id] || 0} words</strong> in this section will stay safe in <strong className="text-slate-700 dark:text-zinc-200">All Words</strong>. You can undo this action within 8 seconds.
                    </p>
                  </div>

                  {actionSheetError && (
                    <p className="text-xs text-rose-500 font-semibold mb-3 text-center">{actionSheetError}</p>
                  )}

                  <div className="flex gap-2.5 pt-4">
                    <button
                      type="button"
                      onClick={() => setSheetMode('options')}
                      className="flex-1 min-h-[44px] py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePerformDelete}
                      disabled={isSubmittingAction}
                      className="flex-1 min-h-[44px] py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{isSubmittingAction ? 'Deleting...' : 'Delete Section'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── MODE: ALL WORDS INFO ── */}
              {sheetMode === 'all_words_info' && (
                <div>
                  <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center space-x-2">
                        <h3
                          className="text-base font-bold truncate"
                          style={{ color: 'var(--voco-text-primary, #0F172A)' }}
                        >
                          All Words
                        </h3>
                        <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                          {words.length} words
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-zinc-400 mt-0.5">
                        Default vocabulary collection
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeActionSheet}
                      className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Info Callout */}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-start space-x-3 mb-3">
                    <Info className="w-5 h-5 text-[#6554F5] dark:text-[#8875F5] shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-950 dark:text-zinc-200 leading-relaxed">
                      <strong>All Words</strong> is your primary library containing every saved word. It cannot be renamed, merged, or deleted.
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectionMode(true);
                        closeActionSheet();
                      }}
                      className="w-full min-h-[50px] px-3.5 py-3 rounded-2xl flex items-center space-x-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                        <CheckSquare className="w-4 h-4 text-[#6554F5]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                          Select Words
                        </p>
                        <p className="text-xs text-slate-400 dark:text-zinc-400">
                          Choose words to add to a custom section or delete
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeActionSheet();
                        handleOpenCreateSection();
                      }}
                      className="w-full min-h-[50px] px-3.5 py-3 rounded-2xl flex items-center space-x-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/60 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-[#6554F5] dark:text-[#8875F5] flex items-center justify-center shrink-0">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                          Create New Section
                        </p>
                        <p className="text-xs text-slate-400 dark:text-zinc-400">
                          Organize your words into custom groups
                        </p>
                      </div>
                    </button>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={closeActionSheet}
                      className="w-full min-h-[44px] py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* ━━ Undo Toast (8-Second Auto Dismiss) ━━ */}
      {undoToast &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-50 animate-fade-in-up"
          >
            <div
              className="p-3.5 rounded-2xl shadow-elevated border flex items-center justify-between gap-3 backdrop-blur-md transition-all"
              style={{
                backgroundColor: 'var(--voco-bg-card, #1B1D25)',
                borderColor: 'var(--voco-border, #30333E)',
                color: 'var(--voco-text-primary, #FFFFFF)',
              }}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-xs font-semibold truncate">
                  {undoToast.message}
                </p>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handlePerformUndo}
                  className="px-3 py-1.5 min-h-[36px] rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer text-white shadow-xs"
                  style={{
                    backgroundColor: 'var(--voco-accent, #6554F5)',
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismissUndoToast}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label="Dismiss toast"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Manage Word Sections Modal */}
      {manageSectionsWord &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-colors overflow-hidden"
          >
            <div className="bg-white dark:bg-[#1B1D25] w-full max-w-sm rounded-2xl shadow-elevated border border-slate-200/90 dark:border-[#30333E] p-6 relative transition-colors animate-fade-in-up">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
                Sections for &ldquo;{manageSectionsWord.word}&rdquo;
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Choose which sections this word belongs to.
              </p>

              {userSections.length === 0 ? (
                <div className="text-center py-6">
                  <Tag className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    No custom sections created yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setManageSectionsWord(null);
                      setShowCreateSectionModal(true);
                    }}
                    className="mt-3 text-xs font-bold text-[#6554F5] dark:text-[#8875F5] hover:underline"
                  >
                    + Create a section first
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-4">
                  {userSections.map((sec) => {
                    const isChecked = manageSelectedSectionIds.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-indigo-50/60 dark:bg-[#6554F5]/10 border-indigo-200 dark:border-[#6554F5]/30 text-indigo-950 dark:text-zinc-100 font-semibold'
                            : 'bg-white dark:bg-[#181A22] border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <span className="text-xs">{sec.name}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSectionForWord(sec.id)}
                          className="w-4 h-4 rounded text-[#6554F5] accent-[#6554F5]"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setManageSectionsWord(null)}
                  className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveWordSections}
                  className="flex-1 py-2.5 px-4 bg-[#6554F5] hover:bg-[#5443E8] text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Batch Add to Section Modal */}
      {showBatchAddModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-colors overflow-hidden"
          >
            <div className="bg-white dark:bg-[#1B1D25] w-full max-w-sm rounded-2xl shadow-elevated border border-slate-200/90 dark:border-[#30333E] p-6 relative transition-colors animate-fade-in-up">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">
                Add {selectedIds.size} Words to Section
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Select target section:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-4">
                {userSections.map((sec) => (
                  <label
                    key={sec.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      batchTargetSectionId === sec.id
                        ? 'bg-indigo-50/60 dark:bg-[#6554F5]/10 border-indigo-200 dark:border-[#6554F5]/30 text-indigo-950 dark:text-zinc-100 font-semibold'
                        : 'bg-white dark:bg-[#181A22] border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="text-xs">{sec.name}</span>
                    <input
                      type="radio"
                      name="batchSection"
                      checked={batchTargetSectionId === sec.id}
                      onChange={() => setBatchTargetSectionId(sec.id)}
                      className="w-4 h-4 text-[#6554F5] accent-[#6554F5]"
                    />
                  </label>
                ))}
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBatchAddModal(false)}
                  className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchAdd}
                  disabled={!batchTargetSectionId}
                  className="flex-1 py-2.5 px-4 bg-[#6554F5] hover:bg-[#5443E8] disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                >
                  Add Words
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Selected Confirmation Dialog — Fixed relative to mobile viewport via Portal */}
      {showDeleteConfirm &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-colors overflow-hidden"
          >
            <div className="bg-white dark:bg-[#1B1D25] w-full max-w-sm rounded-2xl shadow-elevated border border-slate-200/90 dark:border-[#30333E] p-6 relative transition-colors text-center animate-fade-in-up">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3 border border-rose-200 dark:border-rose-900/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1.5">
                Delete Selected Words?
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-5">
                Are you sure you want to delete <strong className="text-slate-800 dark:text-zinc-200">{selectedIds.size}</strong> saved {selectedIds.size === 1 ? 'word' : 'words'}? This action cannot be undone.
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeletingBatch}
                  className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchDelete}
                  disabled={isDeletingBatch}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                >
                  {isDeletingBatch ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
