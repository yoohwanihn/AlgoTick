import { useEffect } from 'react';
import { useThemeStore, applyTheme } from '../../store/themeStore.js';

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      onClick={toggle}
      className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
      aria-label={`테마 전환 (현재: ${theme === 'dark' ? '다크' : '라이트'})`}
      title={`테마 전환 (현재: ${theme === 'dark' ? '🌙 다크' : '☀️ 라이트'})`}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
