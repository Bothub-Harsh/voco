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
    <nav className="shrink-0 w-full z-30 bg-white/97 dark:bg-[#1B1D25]/97 backdrop-blur-lg border-t border-slate-200/90 dark:border-[#30333E] transition-colors safe-bottom">
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
                  ? 'text-[#8875F5] dark:text-[#8875F5]'
                  : 'text-slate-400 dark:text-[#6B6E80] hover:dark:text-[#A5A8B5]'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`relative px-4 py-1 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-[#8875F5]/15 border border-transparent dark:border-[#8875F5]/25'
                    : ''
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive
                      ? 'text-[#8875F5] dark:text-[#8875F5]'
                      : 'text-slate-400 dark:text-[#6B6E80]'
                  }`}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
                {/* Badge for saved words count */}
                {id === 'saved' && savedWordsCount > 0 && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold rounded-full ${
                      isActive
                        ? 'bg-[#6554F5] text-white'
                        : 'bg-slate-300 dark:bg-zinc-700 text-white'
                    }`}
                  >
                    {savedWordsCount > 99 ? '99+' : savedWordsCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold leading-tight transition-colors ${
                  isActive
                    ? 'text-[#6554F5] dark:text-[#6554F5]'
                    : 'text-slate-400 dark:text-zinc-400'
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
