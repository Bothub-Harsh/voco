import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  showCloseButton?: boolean;
  showDragHandle?: boolean;
  footer?: React.ReactNode;
  ariaLabel?: string;
  maxWidthClass?: string; // default 'max-w-md'
  zIndexOverlay?: number; // default 60
  zIndexSheet?: number;   // default 70
}

/**
 * Universal, portal-rendered Bottom Sheet for mobile and tablet.
 *
 * Guaranteed properties:
 * 1. Portaled into document.body so parent transforms/scroll/clips NEVER misplace it.
 * 2. Solid opaque background following theme variables with safe fallbacks.
 * 3. Smooth slide-up under 250ms with reduced-motion accessibility support.
 * 4. Android back button integration via popstate and escape key.
 * 5. Body scroll lock while open.
 * 6. Responsive max-height (85vh / 85dvh) with internal smooth scrolling.
 * 7. Safe-area bottom padding for edge-to-edge mobile screens.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  showCloseButton = true,
  showDragHandle = true,
  footer,
  ariaLabel,
  maxWidthClass = 'max-w-md',
  zIndexOverlay = 60,
  zIndexSheet = 70,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Lock body scroll and register back-button listener
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Track whether history was popped by user pressing back
    let poppedByBack = false;

    // Preserve current history state and add vocoBottomSheet flag
    const currentState = window.history.state || {};
    try {
      window.history.pushState({ ...currentState, vocoBottomSheet: true }, '');
    } catch {
      // History push might fail in isolated test environments
    }

    const handlePopState = () => {
      poppedByBack = true;
      onCloseRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      if (!poppedByBack && window.history.state?.vocoBottomSheet) {
        try {
          window.history.back();
        } catch {}
      }
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : ariaLabel || 'Bottom Sheet'}
      className="voco-bottom-sheet-root"
    >
      {/* ── Dim Overlay / Backdrop ── */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-xs transition-opacity animate-sheet-backdrop"
        style={{ zIndex: zIndexOverlay }}
        onClick={handleBackdropClick}
      />

      {/* ── Slide-up Sheet Container ── */}
      <div
        className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none"
        style={{ zIndex: zIndexSheet }}
      >
        <div
          className={`w-full ${maxWidthClass} rounded-t-3xl shadow-2xl border-t border-x pointer-events-auto flex flex-col transition-transform animate-sheet-slide-up`}
          style={{
            backgroundColor: 'var(--voco-bg-card, #FFFFFF)',
            borderColor: 'var(--voco-border, #CBD5E1)',
            maxHeight: 'min(85dvh, 85vh)',
          }}
          onClick={handleContentClick}
        >
          {/* Drag Handle Bar */}
          {showDragHandle && (
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700/90 shadow-2xs" />
            </div>
          )}

          {/* Header Row */}
          {(title || showCloseButton) && (
            <div className="px-5 pt-1.5 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-[#2E3341] shrink-0">
              <div className="min-w-0 pr-3">
                {typeof title === 'string' ? (
                  <h3
                    className="text-sm sm:text-base font-bold truncate leading-tight"
                    style={{ color: 'var(--voco-text-primary, #0F172A)' }}
                  >
                    {title}
                  </h3>
                ) : (
                  title
                )}
                {subtitle && (
                  <p className="text-xs text-slate-400 dark:text-zinc-400 mt-0.5 leading-snug">
                    {subtitle}
                  </p>
                )}
              </div>

              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 -mr-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>
          )}

          {/* Internal Scrollable Body */}
          <div className="px-5 py-4 overflow-y-auto overscroll-contain flex-1 text-xs space-y-3">
            {children}
          </div>

          {/* Optional Footer with Safe-Bottom Padding */}
          {footer && (
            <div
              className="p-4 pt-2 border-t border-slate-100 dark:border-[#2E3341] shrink-0"
              style={{
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
                backgroundColor: 'var(--voco-bg-card, #FFFFFF)',
              }}
            >
              {footer}
            </div>
          )}

          {/* Default Safe-Bottom Spacer if no footer */}
          {!footer && (
            <div
              style={{
                height: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
