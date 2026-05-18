'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SidebarState {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed }),
      toggle: () => set({ collapsed: !get().collapsed }),
    }),
    {
      name: 'workforce.sidebar',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
