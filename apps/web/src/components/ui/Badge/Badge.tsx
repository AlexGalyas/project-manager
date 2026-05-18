'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Badge.module.scss';

export type BadgeVariant =
  | 'default'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Show a small status dot in the leading position. */
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'default', size = 'sm', dot, className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={clsx(
        styles.root,
        styles[`variant_${variant}`],
        styles[`size_${size}`],
        className,
      )}
      {...rest}
    >
      {dot && <span className={styles.dot} aria-hidden />}
      <span>{children}</span>
    </span>
  );
});
