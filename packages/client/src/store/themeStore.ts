import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggle: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      set: (t) => set({ theme: t }),
    }),
    { name: 'algotick-theme' },
  ),
);

export function applyTheme(theme: Theme) {
  const html = document.documentElement;
  if (theme === 'dark') html.classList.add('dark');
  else html.classList.remove('dark');
}
