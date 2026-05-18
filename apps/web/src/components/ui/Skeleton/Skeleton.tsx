'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Skeleton.module.scss';

export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  width?: number | string;
  height?: number | string;
  /** Render as a perfect circle (overrides border-radius). */
  circle?: boolean;
  /** Render multiple stacked lines. Useful for fake paragraphs. */
  lines?: number;
}

export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton(
  { width, height, circle, lines = 1, className, style, ...rest },
  ref,
) {
  if (lines > 1) {
    return (
      <span ref={ref} className={clsx(styles.stack, className)} {...rest}>
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={styles.bar}
            style={{
              width: i === lines - 1 ? '70%' : '100%',
              height: height ?? '0.9em',
            }}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      ref={ref}
      className={clsx(styles.bar, circle && styles.circle, className)}
      style={{ width, height, ...style }}
      aria-hidden
      {...rest}
    />
  );
});
