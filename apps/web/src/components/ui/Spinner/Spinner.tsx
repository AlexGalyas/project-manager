'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Spinner.module.scss';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: SpinnerSize;
  label?: string;
  inline?: boolean;
}

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = 'md', label = 'Loading', inline = false, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={clsx(styles.root, inline && styles.inline, className)}
      role="status"
      aria-live="polite"
      aria-label={label}
      {...rest}
    >
      <span className={clsx(styles.ring, styles[`size_${size}`])} aria-hidden />
      {!inline && <span className={styles.text}>{label}…</span>}
    </span>
  );
});
