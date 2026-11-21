import { describe, it, expect, beforeEach } from 'vitest';
import {
  THEMES,
  THEME_LIST,
  getThemeDefinition,
  getSavedTheme,
  applyTheme,
  setTheme,
  cycleTheme,
  toggleTheme,
  initTheme,
  type ThemeId,
} from '../src/services/theme';

describe('Voco 8 Theme Customization System', () => {
  const ALL_THEME_IDS: ThemeId[] = [
    'clean-light',
    'midnight',
    'rose',
    'nature',
    'ocean',
    'sunset',
    'lavender',
    'amoled',
  ];

  let store: Map<string, string>;
  let classListSet: Set<string>;
  let styleProps: Map<string, string>;
  let attributes: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
    classListSet = new Set<string>();
    styleProps = new Map<string, string>();
    attributes = new Map<string, string>();

    // Mock localStorage
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, String(val)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage;

    // Mock document & documentElement
    const mockDocumentElement = {
      classList: {
        add: (c: string) => classListSet.add(c),
        remove: (c: string) => classListSet.delete(c),
        contains: (c: string) => classListSet.has(c),
      },
      style: {
        colorScheme: 'light',
        setProperty: (prop: string, val: string) => styleProps.set(prop, val),
        getPropertyValue: (prop: string) => styleProps.get(prop) || '',
      },
      setAttribute: (attr: string, val: string) => attributes.set(attr, val),
      getAttribute: (attr: string) => attributes.get(attr) || null,
      removeAttribute: (attr: string) => attributes.delete(attr),
    };

    const headElements: any[] = [];

    const mockHead = {
      appendChild: (el: any) => {
        headElements.push(el);
      },
    };

    globalThis.document = {
      documentElement: mockDocumentElement,
      head: mockHead,
      querySelector: (selector: string) => {
        if (selector === 'meta[name="theme-color"]') {
          return headElements.find((m) => m.getAttribute && m.getAttribute('name') === 'theme-color') || null;
        }
        return null;
      },
      createElement: (tag: string) => {
        const attrs = new Map<string, string>();
        return {
          tagName: tag.toUpperCase(),
          setAttribute: (k: string, v: string) => attrs.set(k, v),
          getAttribute: (k: string) => attrs.get(k) || null,
        };
      },
    } as unknown as Document;

    globalThis.window = {
      matchMedia: () => ({ matches: false } as MediaQueryList),
    } as unknown as Window & typeof globalThis;
  });

  describe('1. Theme Definitions & Completeness', () => {
    it('defines exactly 8 themes', () => {
      expect(Object.keys(THEMES)).toHaveLength(8);
      expect(THEME_LIST).toHaveLength(8);
    });

    it('contains all required themes by ID', () => {
      ALL_THEME_IDS.forEach((id) => {
        expect(THEMES[id]).toBeDefined();
        expect(THEMES[id].id).toBe(id);
      });
    });

    it('verifies dark vs light configuration for all 8 themes', () => {
      expect(THEMES['clean-light'].isDark).toBe(false);
      expect(THEMES['midnight'].isDark).toBe(true);
      expect(THEMES['rose'].isDark).toBe(false);
      expect(THEMES['nature'].isDark).toBe(false);
      expect(THEMES['ocean'].isDark).toBe(false);
      expect(THEMES['sunset'].isDark).toBe(false);
      expect(THEMES['lavender'].isDark).toBe(false);
      expect(THEMES['amoled'].isDark).toBe(true);
    });

    it('AMOLED theme has pure black background (#000000)', () => {
      expect(THEMES['amoled'].colors.bgPage).toBe('#000000');
      expect(THEMES['amoled'].colors.bgCard).toBe('#000000');
      expect(THEMES['amoled'].colors.statusBar).toBe('#000000');
    });

    it('every theme contains 4 valid preview color hex codes', () => {
      ALL_THEME_IDS.forEach((id) => {
        const theme = THEMES[id];
        expect(theme.previewColors).toHaveLength(4);
        theme.previewColors.forEach((color) => {
          expect(color.startsWith('#') || color.startsWith('rgb')).toBe(true);
        });
      });
    });

    it('every theme contains required CSS variable color properties', () => {
      ALL_THEME_IDS.forEach((id) => {
        const c = THEMES[id].colors;
        expect(c.bgPage).toBeTruthy();
        expect(c.bgCard).toBeTruthy();
        expect(c.bgSurface).toBeTruthy();
        expect(c.border).toBeTruthy();
        expect(c.textPrimary).toBeTruthy();
        expect(c.textMuted).toBeTruthy();
        expect(c.accent).toBeTruthy();
        expect(c.accentSoft).toBeTruthy();
        expect(c.accentBorder).toBeTruthy();
      });
    });
  });

  describe('2. Legacy Theme Migration & Persistence', () => {
    it('migrates legacy "light" to "clean-light"', () => {
      store.set('voco_theme', 'light');
      expect(getSavedTheme()).toBe('clean-light');
    });

    it('migrates legacy "dark" to "midnight"', () => {
      store.set('voco_theme', 'dark');
      expect(getSavedTheme()).toBe('midnight');
    });

    it('retrieves saved 8-theme ID directly from localStorage', () => {
      ALL_THEME_IDS.forEach((id) => {
        store.set('voco_theme', id);
        expect(getSavedTheme()).toBe(id);
      });
    });

    it('ignores invalid theme IDs in localStorage', () => {
      store.set('voco_theme', 'non-existent-theme');
      expect(getSavedTheme()).toBeNull();
    });
  });

  describe('3. Applying Themes to DOM', () => {
    it('applies data-theme and CSS custom properties to document root', () => {
      applyTheme('rose');
      expect(attributes.get('data-theme')).toBe('rose');
      expect(classListSet.has('dark')).toBe(false);
      expect(styleProps.get('--voco-accent')).toBe(THEMES['rose'].colors.accent);
      expect(styleProps.get('--voco-bg-page')).toBe(THEMES['rose'].colors.bgPage);
      expect(store.get('voco_theme')).toBe('rose');
    });

    it('applies dark mode class and colorScheme for midnight theme', () => {
      applyTheme('midnight');
      expect(attributes.get('data-theme')).toBe('midnight');
      expect(classListSet.has('dark')).toBe(true);
      expect(styleProps.get('--voco-accent')).toBe(THEMES['midnight'].colors.accent);
    });

    it('applies dark mode class and colorScheme for amoled theme', () => {
      applyTheme('amoled');
      expect(attributes.get('data-theme')).toBe('amoled');
      expect(classListSet.has('dark')).toBe(true);
      expect(styleProps.get('--voco-bg-page')).toBe('#000000');
    });

    it('sets meta[name="theme-color"] in the document head', () => {
      applyTheme('ocean');
      const meta = document.querySelector('meta[name="theme-color"]');
      expect(meta).not.toBeNull();
      expect(meta?.getAttribute('content')).toBe(THEMES['ocean'].colors.statusBar);
    });
  });

  describe('4. Theme Switching & Cycling', () => {
    it('setTheme sets and persists the chosen theme', () => {
      const res = setTheme('lavender');
      expect(res).toBe('lavender');
      expect(attributes.get('data-theme')).toBe('lavender');
      expect(store.get('voco_theme')).toBe('lavender');
    });

    it('cycleTheme cycles cleanly through all 8 themes', () => {
      setTheme('clean-light');
      const expectedSequence: ThemeId[] = [
        'midnight',
        'rose',
        'nature',
        'ocean',
        'sunset',
        'lavender',
        'amoled',
        'clean-light',
      ];

      expectedSequence.forEach((expectedNext) => {
        const next = cycleTheme();
        expect(next).toBe(expectedNext);
        expect(attributes.get('data-theme')).toBe(expectedNext);
      });
    });

    it('toggleTheme delegates to cycleTheme', () => {
      setTheme('sunset');
      const next = toggleTheme();
      expect(next).toBe('lavender');
    });

    it('initTheme loads and applies saved theme or falls back gracefully', () => {
      store.set('voco_theme', 'nature');
      const initiated = initTheme();
      expect(initiated).toBe('nature');
      expect(attributes.get('data-theme')).toBe('nature');
    });

    it('getThemeDefinition returns default Clean Light when invalid ID provided', () => {
      // @ts-expect-error testing invalid ID
      const def = getThemeDefinition('unknown-xyz');
      expect(def.id).toBe('clean-light');
    });
  });

  describe('5. Native Theme Storage Synchronization', () => {
    it('safely handles syncThemeToNative in non-native / browser environments without crashing', async () => {
      const { syncThemeToNative, getNativeTheme } = await import('../src/services/notifications');
      await expect(syncThemeToNative('rose')).resolves.not.toThrow();
      const theme = await getNativeTheme();
      expect(theme).toBeNull(); // On web/node it returns null
    });

    it('applyTheme triggers syncThemeToNative gracefully', () => {
      expect(() => applyTheme('amoled')).not.toThrow();
      expect(attributes.get('data-theme')).toBe('amoled');
    });
  });
});
