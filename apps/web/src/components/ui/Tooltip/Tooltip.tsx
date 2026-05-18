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
import styles from './Tooltip.module.scss';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  content: React.ReactNode;
  side?: TooltipSide;
  delay?: number;
  children: React.ReactElement;
}

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function Tooltip({ content, side = 'top', delay = 300, children }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; resolvedSide: TooltipSide }>(
    { top: 0, left: 0, resolvedSide: side },
  );
  const timerRef = useRef<number | null>(null);

  const show = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') hide();
    }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hide]);

  // Compute position whenever it opens; flip if it would clip the viewport.
  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const tip = tooltipRef.current;
    if (!trigger || !tip) return;

    const tr = trigger.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const gap = 8;
    const order: TooltipSide[] = [side, 'top', 'bottom', 'right', 'left'];

    for (const candidate of order) {
      const c = computePos(candidate, tr, tw, th, gap);
      if (fitsInViewport(c, tw, th)) {
        setCoords({ ...c, resolvedSide: candidate });
        return;
      }
    }
    // None fit cleanly — use the requested side anyway.
    const fallback = computePos(side, tr, tw, th, gap);
    setCoords({ ...fallback, resolvedSide: side });
  }, [open, side]);

  if (!isValidElement(children)) return children;

  const triggerProps = {
    ref: (node: HTMLElement) => {
      triggerRef.current = node;
      const inner = (children as unknown as { ref?: React.Ref<unknown> }).ref;
      if (typeof inner === 'function') inner(node);
      else if (inner && typeof inner === 'object') {
        (inner as React.MutableRefObject<unknown>).current = node;
      }
    },
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    'aria-describedby': open ? id : undefined,
  };

  return (
    <>
      {cloneElement(children, triggerProps as Record<string, unknown>)}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              id={id}
              role="tooltip"
              ref={tooltipRef}
              className={clsx(styles.tooltip, styles[`side_${coords.resolvedSide}`])}
              style={{ top: coords.top, left: coords.left }}
            >
              {content}
              <span className={styles.arrow} aria-hidden />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function computePos(side: TooltipSide, tr: DOMRect, tw: number, th: number, gap: number) {
  switch (side) {
    case 'top':
      return { top: tr.top - th - gap + window.scrollY, left: tr.left + tr.width / 2 - tw / 2 + window.scrollX };
    case 'bottom':
      return { top: tr.bottom + gap + window.scrollY, left: tr.left + tr.width / 2 - tw / 2 + window.scrollX };
    case 'right':
      return { top: tr.top + tr.height / 2 - th / 2 + window.scrollY, left: tr.right + gap + window.scrollX };
    case 'left':
      return { top: tr.top + tr.height / 2 - th / 2 + window.scrollY, left: tr.left - tw - gap + window.scrollX };
  }
}

function fitsInViewport(pos: { top: number; left: number }, tw: number, th: number) {
  const padding = 8;
  const minLeft = window.scrollX + padding;
  const maxLeft = window.scrollX + window.innerWidth - tw - padding;
  const minTop = window.scrollY + padding;
  const maxTop = window.scrollY + window.innerHeight - th - padding;
  return pos.left >= minLeft && pos.left <= maxLeft && pos.top >= minTop && pos.top <= maxTop;
}
