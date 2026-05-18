'use client';

import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import styles from './Switch.module.scss';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { id, label, description, className, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const swId = id ?? `sw-${autoId}`;

  return (
    <label htmlFor={swId} className={clsx(styles.root, disabled && styles.disabled, className)}>
      <span className={styles.track}>
        <input
          ref={ref}
          id={swId}
          type="checkbox"
          role="switch"
          disabled={disabled}
          className={styles.input}
          {...rest}
        />
        <span className={styles.thumb} aria-hidden />
      </span>
      {(label || description) && (
        <span className={styles.text}>
          {label && <span className={styles.label}>{label}</span>}
          {description && <span className={styles.description}>{description}</span>}
        </span>
      )}
    </label>
  );
});
