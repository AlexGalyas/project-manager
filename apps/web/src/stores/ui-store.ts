'use client';

import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface UIState {
  toasts: Toast[];
  toast: (message: string, kind?: ToastKind, opts?: { timeout?: number }) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const DEFAULT_TIMEOUT_MS = 4500;

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],

  toast: (message, kind = 'info', opts) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    set({ toasts: [...get().toasts, { id, kind, message }] });
    if (typeof window !== 'undefined') {
      const ms = opts?.timeout ?? DEFAULT_TIMEOUT_MS;
      window.setTimeout(() => {
        set({ toasts: get().toasts.filter((t) => t.id !== id) });
      }, ms);
    }
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  clearToasts: () => set({ toasts: [] }),
}));

/** Convenience: pull message off an Error/ApiError-shaped value and push a toast. */
export function toastError(err: unknown, fallback = 'Something went wrong') {
  const message = err instanceof Error ? err.message : fallback;
  useUIStore.getState().toast(message, 'error');
}

export function toastSuccess(message: string) {
  useUIStore.getState().toast(message, 'success');
}
