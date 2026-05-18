'use client';

import { forwardRef, useState } from 'react';
import clsx from 'clsx';
import styles from './Avatar.module.scss';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** Override the auto-picked accent. Useful for status colors (e.g. employee.over). */
  tone?: 'auto' | 'accent' | 'muted';
}

// 8 muted hash buckets that sit well against both themes.
const TONES = [
  { bg: 'rgba(99, 102, 241, 0.14)', fg: '#6366f1' },  // indigo
  { bg: 'rgba(16, 185, 129, 0.14)', fg: '#059669' },  // emerald
  { bg: 'rgba(245, 158, 11, 0.14)', fg: '#d97706' },  // amber
  { bg: 'rgba(239, 68, 68, 0.14)', fg: '#dc2626' },   // red
  { bg: 'rgba(59, 130, 246, 0.14)', fg: '#2563eb' },  // blue
  { bg: 'rgba(168, 85, 247, 0.14)', fg: '#9333ea' },  // purple
  { bg: 'rgba(20, 184, 166, 0.14)', fg: '#0d9488' },  // teal
  { bg: 'rgba(236, 72, 153, 0.14)', fg: '#db2777' },  // pink
];

function hashIndex(seed: string, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % max;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { name, src, size = 'md', tone = 'auto', className, style, ...rest },
  ref,
) {
  const [imgFailed, setImgFailed] = useState(false);

  let bg = 'var(--color-bg-muted)';
  let fg = 'var(--color-text)';
  if (tone === 'auto') {
    const t = TONES[hashIndex(name, TONES.length)]!;
    bg = t.bg;
    fg = t.fg;
  } else if (tone === 'accent') {
    bg = 'var(--color-accent-subtle)';
    fg = 'var(--color-accent-text)';
  }

  const showImage = src && !imgFailed;

  return (
    <span
      ref={ref}
      className={clsx(styles.root, styles[`size_${size}`], className)}
      style={showImage ? style : { background: bg, color: fg, ...style }}
      aria-label={name}
      role="img"
      {...rest}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={styles.img}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={styles.initials}>{initials(name)}</span>
      )}
    </span>
  );
});
