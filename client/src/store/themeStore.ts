import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';

// Pasos de tamaño de interfaz. Escalan el font-size raíz, y como el resto de
// la app usa unidades rem (texto, íconos, paddings), todo crece o achica
// proporcionalmente sin tener que tocar cada pantalla. Es independiente del
// zoom del navegador/SO: cada usuario elige el suyo y queda guardado.
export const UI_SCALE_STEPS = [0.875, 1, 1.125, 1.25] as const;
export type UiScale = (typeof UI_SCALE_STEPS)[number];

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  uiScale: UiScale;
  setUiScale: (scale: UiScale) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark'
      })),
      uiScale: 1,
      setUiScale: (scale) => set({ uiScale: scale }),
    }),
    {
      name: 'prime-burgers-theme',
    }
  )
);
