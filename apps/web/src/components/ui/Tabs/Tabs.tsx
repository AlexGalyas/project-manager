'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import styles from './Tabs.module.scss';

export interface Tab {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeKey, onChange, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useLayoutEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLButtonElement>(
      `[data-tab-key="${activeKey}"]`,
    );
    if (!active) return;
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, [activeKey, tabs]);

  return (
    <div ref={listRef} className={clsx(styles.tabs, className)} role="tablist">
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-tab-key={t.key}
            className={clsx(styles.tab, active && styles.tabActive)}
            onClick={() => onChange(t.key)}
          >
            {t.icon && <span className={styles.icon}>{t.icon}</span>}
            {t.label}
          </button>
        );
      })}
      <span
        className={styles.indicator}
        style={{ left: indicator.left, width: indicator.width }}
        aria-hidden
      />
    </div>
  );
}
