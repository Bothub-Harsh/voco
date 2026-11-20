export type ThemeId =
  | 'clean-light'
  | 'midnight'
  | 'rose'
  | 'nature'
  | 'ocean'
  | 'sunset'
  | 'lavender'
  | 'amoled';

export type Theme = ThemeId;

export interface ThemeColors {
  bgPage: string;
  bgCard: string;
  bgSurface: string;
  bgSurfaceHover: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentBorder: string;
  statusBar: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  subtitle: string;
  isDark: boolean;
  previewColors: [string, string, string, string]; // [Page BG, Card BG, Accent, Text]
  colors: ThemeColors;
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  'clean-light': {
    id: 'clean-light',
    name: 'Clean Light',
    subtitle: 'White background, soft purple accents',
    isDark: false,
    previewColors: ['#F8FAFC', '#FFFFFF', '#6554F5', '#0F172A'],
    colors: {
      bgPage: '#F8FAFC',
      bgCard: '#FFFFFF',
      bgSurface: '#F1F5F9',
      bgSurfaceHover: '#E2E8F0',
      border: '#CBD5E1',
      borderSubtle: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
      accent: '#6554F5',
      accentHover: '#5243E4',
      accentSoft: '#EEF2FF',
      accentBorder: '#C7D2FE',
      statusBar: '#F8FAFC',
    },
  },
  'midnight': {
    id: 'midnight',
    name: 'Midnight Dark',
    subtitle: 'Dark charcoal background, purple accents',
    isDark: true,
    previewColors: ['#121318', '#1B1D25', '#8875F5', '#F1F1F5'],
    colors: {
      bgPage: '#121318',
      bgCard: '#1B1D25',
      bgSurface: '#222530',
      bgSurfaceHover: '#2A2E3C',
      border: '#3E4452',
      borderSubtle: '#2E3341',
      textPrimary: '#F1F1F5',
      textSecondary: '#C8CADB',
      textMuted: '#A5A8B5',
      accent: '#8875F5',
      accentHover: '#7562EB',
      accentSoft: 'rgba(136, 117, 245, 0.15)',
      accentBorder: 'rgba(136, 117, 245, 0.3)',
      statusBar: '#121318',
    },
  },
  'rose': {
    id: 'rose',
    name: 'Rose',
    subtitle: 'Soft pink, cream and rose accents',
    isDark: false,
    previewColors: ['#FFF1F2', '#FFFFFF', '#E11D48', '#881337'],
    colors: {
      bgPage: '#FFF1F2',
      bgCard: '#FFFFFF',
      bgSurface: '#FFE4E6',
      bgSurfaceHover: '#FECDD3',
      border: '#FDA4AF',
      borderSubtle: '#FECDD3',
      textPrimary: '#881337',
      textSecondary: '#9F1239',
      textMuted: '#BE123C',
      accent: '#E11D48',
      accentHover: '#BE123C',
      accentSoft: '#FFE4E6',
      accentBorder: '#FDA4AF',
      statusBar: '#FFF1F2',
    },
  },
  'nature': {
    id: 'nature',
    name: 'Nature',
    subtitle: 'Sage green, off-white and earthy accents',
    isDark: false,
    previewColors: ['#F0FDF4', '#FFFFFF', '#16A34A', '#14532D'],
    colors: {
      bgPage: '#F0FDF4',
      bgCard: '#FFFFFF',
      bgSurface: '#DCFCE7',
      bgSurfaceHover: '#BBF7D0',
      border: '#86EFAC',
      borderSubtle: '#BBF7D0',
      textPrimary: '#14532D',
      textSecondary: '#166534',
      textMuted: '#15803D',
      accent: '#16A34A',
      accentHover: '#15803D',
      accentSoft: '#DCFCE7',
      accentBorder: '#86EFAC',
      statusBar: '#F0FDF4',
    },
  },
  'ocean': {
    id: 'ocean',
    name: 'Ocean',
    subtitle: 'Light blue, navy and white',
    isDark: false,
    previewColors: ['#F0F9FF', '#FFFFFF', '#0284C7', '#0C4A6E'],
    colors: {
      bgPage: '#F0F9FF',
      bgCard: '#FFFFFF',
      bgSurface: '#E0F2FE',
      bgSurfaceHover: '#BAE6FD',
      border: '#7DD3FC',
      borderSubtle: '#BAE6FD',
      textPrimary: '#0C4A6E',
      textSecondary: '#0369A1',
      textMuted: '#0284C7',
      accent: '#0284C7',
      accentHover: '#0369A1',
      accentSoft: '#E0F2FE',
      accentBorder: '#7DD3FC',
      statusBar: '#F0F9FF',
    },
  },
  'sunset': {
    id: 'sunset',
    name: 'Sunset',
    subtitle: 'Warm beige, orange and brown',
    isDark: false,
    previewColors: ['#FFFBEB', '#FFFFFF', '#D97706', '#78350F'],
    colors: {
      bgPage: '#FFFBEB',
      bgCard: '#FFFFFF',
      bgSurface: '#FEF3C7',
      bgSurfaceHover: '#FDE68A',
      border: '#FCD34D',
      borderSubtle: '#FDE68A',
      textPrimary: '#78350F',
      textSecondary: '#92400E',
      textMuted: '#B45309',
      accent: '#D97706',
      accentHover: '#B45309',
      accentSoft: '#FEF3C7',
      accentBorder: '#FCD34D',
      statusBar: '#FFFBEB',
    },
  },
  'lavender': {
    id: 'lavender',
    name: 'Lavender',
    subtitle: 'Soft lavender and violet',
    isDark: false,
    previewColors: ['#FAF5FF', '#FFFFFF', '#9333EA', '#581C87'],
    colors: {
      bgPage: '#FAF5FF',
      bgCard: '#FFFFFF',
      bgSurface: '#F3E8FF',
      bgSurfaceHover: '#E9D5FF',
      border: '#D8B4FE',
      borderSubtle: '#E9D5FF',
      textPrimary: '#581C87',
      textSecondary: '#6B21A8',
      textMuted: '#7E22CE',
      accent: '#9333EA',
      accentHover: '#7E22CE',
      accentSoft: '#F3E8FF',
      accentBorder: '#D8B4FE',
      statusBar: '#FAF5FF',
    },
  },
  'amoled': {
    id: 'amoled',
    name: 'AMOLED',
    subtitle: 'Pure black background with vibrant purple accents',
    isDark: true,
    previewColors: ['#000000', '#000000', '#A855F7', '#FFFFFF'],
    colors: {
      bgPage: '#000000',
      bgCard: '#000000',
      bgSurface: '#0D0D11',
      bgSurfaceHover: '#18181D',
      border: '#2A2A34',
      borderSubtle: '#1A1A22',
      textPrimary: '#FFFFFF',
      textSecondary: '#D4D4D8',
      textMuted: '#A1A1AA',
      accent: '#A855F7',
      accentHover: '#9333EA',
      accentSoft: 'rgba(168, 85, 247, 0.16)',
      accentBorder: 'rgba(168, 85, 247, 0.35)',
      statusBar: '#000000',
    },
  },
};

export const THEME_LIST: ThemeDefinition[] = [
  THEMES['clean-light'],
  THEMES['midnight'],
  THEMES['rose'],
  THEMES['nature'],
  THEMES['ocean'],
  THEMES['sunset'],
  THEMES['lavender'],
  THEMES['amoled'],
];

const THEME_STORAGE_KEY = 'voco_theme';

export function getSavedTheme(): ThemeId | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      // Backwards compatibility with legacy 'light' / 'dark' values
      if (saved === 'light') return 'clean-light';
      if (saved === 'dark') return 'midnight';
      if (saved in THEMES) {
        return saved as ThemeId;
      }
    }
  } catch {
    // LocalStorage might fail in restricted environments
  }
  return null;
}

export function getSystemPrefersDark(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function getCurrentTheme(): ThemeId {
  const saved = getSavedTheme();
  if (saved && saved in THEMES) return saved;
  return getSystemPrefersDark() ? 'midnight' : 'clean-light';
}

export function getThemeDefinition(themeId?: ThemeId): ThemeDefinition {
  const id = themeId || getCurrentTheme();
  return THEMES[id] || THEMES['clean-light'];
}

export function applyTheme(themeId: ThemeId): void {
  if (typeof document === 'undefined') return;

  const theme = THEMES[themeId] || THEMES['clean-light'];
  const root = document.documentElement;

  // Set data-theme attribute
  root.setAttribute('data-theme', theme.id);

  // Set dark mode class and colorScheme
  if (theme.isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  // Set dynamic CSS custom properties on document root
  root.style.setProperty('--voco-bg-page', theme.colors.bgPage);
  root.style.setProperty('--voco-bg-card', theme.colors.bgCard);
  root.style.setProperty('--voco-bg-surface', theme.colors.bgSurface);
  root.style.setProperty('--voco-bg-surface-hover', theme.colors.bgSurfaceHover);
  root.style.setProperty('--voco-border', theme.colors.border);
  root.style.setProperty('--voco-border-subtle', theme.colors.borderSubtle);
  root.style.setProperty('--voco-text-primary', theme.colors.textPrimary);
  root.style.setProperty('--voco-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--voco-text-muted', theme.colors.textMuted);
  root.style.setProperty('--voco-accent', theme.colors.accent);
  root.style.setProperty('--voco-accent-hover', theme.colors.accentHover);
  root.style.setProperty('--voco-accent-soft', theme.colors.accentSoft);
  root.style.setProperty('--voco-accent-border', theme.colors.accentBorder);

  // Update meta theme-color for mobile status bar / browser chrome
  try {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', theme.colors.statusBar);
  } catch {
    // Ignore DOM restriction errors
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  } catch {
    // Ignore storage errors
  }
}

export function setTheme(themeId: ThemeId): ThemeId {
  applyTheme(themeId);
  return themeId;
}

export function cycleTheme(): ThemeId {
  const current = getCurrentTheme();
  const themeIds: ThemeId[] = [
    'clean-light',
    'midnight',
    'rose',
    'nature',
    'ocean',
    'sunset',
    'lavender',
    'amoled',
  ];
  const idx = themeIds.indexOf(current);
  const next = themeIds[(idx + 1) % themeIds.length];
  applyTheme(next);
  return next;
}

export function toggleTheme(): ThemeId {
  return cycleTheme();
}

export function initTheme(): ThemeId {
  const theme = getCurrentTheme();
  applyTheme(theme);
  return theme;
}
