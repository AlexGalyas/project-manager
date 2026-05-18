'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemePreference } from '@/stores/theme-store';
import styles from './ThemeToggle.module.scss';

interface Option {
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}

const OPTIONS: Option[] = [
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
];

/**
 * Compact segmented theme switch. Reads `preference` from useThemeStore.
 *
 * The store is Zustand-persisted; before hydration the rendered "current"
 * pip will match the SSR default ('system'), so we gate the visible state on
 * a `hydrated` flag to avoid a hydration-mismatch warning. Until then both
 * server and client render the same fallback shape.
 */
export function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div className={styles.group} role="radiogroup" aria-label="Theme">
      {OPTIONS.map((opt) => {
        const active = hydrated && preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={active ? styles.btnActive : styles.btn}
            onClick={() => setPreference(opt.value)}
            role="radio"
            aria-checked={active}
            aria-label={`${opt.label} theme`}
            title={`${opt.label} theme`}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
