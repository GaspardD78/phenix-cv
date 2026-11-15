import { useState, useEffect, useCallback } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'phenixcv_theme';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(preference: ThemePreference) {
  const resolved = preference === 'system' ? getSystemTheme() : preference;
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/** Applique le thème enregistré avant le premier rendu (évite un flash et les écrans toujours sombres). */
export function initTheme(): void {
  let saved: ThemePreference = 'light';
  try {
    const v = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    if (v && ['light', 'dark', 'system'].includes(v)) saved = v;
  } catch { /* ignore */ }
  applyTheme(saved);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      if (saved && ['light', 'dark', 'system'].includes(saved)) return saved;
    } catch { /* ignore */ }
    return 'light';
  });

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    try { localStorage.setItem(STORAGE_KEY, newTheme); } catch { /* ignore */ }
    applyTheme(newTheme);
  }, []);

  // Apply on mount
  useEffect(() => {
    applyTheme(theme);
  }, []);

  // Listen for system theme changes when preference is 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme };
}
