'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import styles from './Dropdown.module.scss';

export type DropdownAlign = 'start' | 'end';

export interface DropdownItem {
  kind?: 'item';
  label: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface DropdownSeparator {
  kind: 'separator';
}

export type DropdownEntry = DropdownItem | DropdownSeparator;

export interface DropdownProps {
  trigger: React.ReactElement;
  items: DropdownEntry[];
  align?: DropdownAlign;
  minWidth?: number;
  className?: string;
}

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function Dropdown({
  trigger,
  items,
  align = 'start',
  minWidth = 200,
  className,
}: DropdownProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<number>(-1);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const menuId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setFocused(-1);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        menuRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
      setFocused(-1);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocused((f) => nextEnabled(items, f, +1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocused((f) => nextEnabled(items, f, -1));
      } else if (e.key === 'Enter' && focused >= 0) {
        e.preventDefault();
        const entry = items[focused];
        if (entry && entry.kind !== 'separator' && !entry.disabled) {
          entry.onSelect();
          close();
        }
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, items, focused, close]);

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const t = triggerRef.current;
    const m = menuRef.current;
    if (!t || !m) return;
    const tr = t.getBoundingClientRect();
    const mw = Math.max(m.offsetWidth, minWidth);
    let left = align === 'start' ? tr.left : tr.right - mw;
    left += window.scrollX;
    const top = tr.bottom + 4 + window.scrollY;
    setCoords({ top, left });
  }, [open, align, minWidth]);

  if (!isValidElement(trigger)) return null;

  const triggerProps = {
    ref: (node: HTMLElement) => {
      triggerRef.current = node;
      const inner = (trigger as unknown as { ref?: React.Ref<unknown> }).ref;
      if (typeof inner === 'function') inner(node);
      else if (inner && typeof inner === 'object') {
        (inner as React.MutableRefObject<unknown>).current = node;
      }
    },
    onClick: (e: React.MouseEvent) => {
      const original = (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick;
      if (original) original(e);
      setOpen((v) => {
        if (!v) setFocused(nextEnabled(items, -1, +1));
        return !v;
      });
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': menuId,
  };

  return (
    <>
      {cloneElement(trigger, triggerProps as Record<string, unknown>)}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              id={menuId}
              role="menu"
              ref={menuRef}
              className={clsx(styles.menu, className)}
              style={{ top: coords.top, left: coords.left, minWidth }}
            >
              {items.map((entry, i) =>
                entry.kind === 'separator' ? (
                  <div key={i} className={styles.separator} role="separator" />
                ) : (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    className={clsx(
                      styles.item,
                      entry.danger && styles.itemDanger,
                      focused === i && styles.itemFocused,
                    )}
                    disabled={entry.disabled}
                    onMouseEnter={() => setFocused(i)}
                    onClick={() => {
                      entry.onSelect();
                      close();
                    }}
                  >
                    {entry.icon && <span className={styles.icon}>{entry.icon}</span>}
                    <span className={styles.text}>
                      <span className={styles.label}>{entry.label}</span>
                      {entry.description && (
                        <span className={styles.description}>{entry.description}</span>
                      )}
                    </span>
                  </button>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function nextEnabled(items: DropdownEntry[], from: number, step: 1 | -1): number {
  const n = items.length;
  if (n === 0) return -1;
  let idx = from;
  for (let i = 0; i < n; i += 1) {
    idx = (idx + step + n) % n;
    const entry = items[idx];
    if (entry && entry.kind !== 'separator' && !entry.disabled) return idx;
  }
  return -1;
}
