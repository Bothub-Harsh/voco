import React from 'react';
import { PlusCircle, BookMarked, Settings, type LucideIcon } from 'lucide-react';

export type TabId = 'add' | 'saved' | 'settings';

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

const tabs: TabDef[] = [
  { id: 'add', label: 'Add Words', icon: PlusCircle },
  { id: 'saved', label: 'Saved Words', icon: BookMarked },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  savedWordsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  savedWordsCount,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-zinc-800/80 transition-colors safe-bottom">
      <div className="max-w-2xl mx-auto flex items-stretch">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 pt-2 gap-0.5 transition-all active:scale-95 ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`relative px-4 py-1 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/50'
                    : ''
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-zinc-500'
                  }`}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
                {/* Badge for saved words count */}
                {id === 'saved' && savedWordsCount > 0 && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold rounded-full ${
                      isActive
                        ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                        : 'bg-slate-300 dark:bg-zinc-600 text-white'
                    }`}
                  >
                    {savedWordsCount > 99 ? '99+' : savedWordsCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold leading-tight transition-colors ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-zinc-500'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
