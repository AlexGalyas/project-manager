'use client';

import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import { Check, Minus } from 'lucide-react';
import styles from './Checkbox.module.scss';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
  description?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id, label, description, indeterminate, className, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const cbId = id ?? `cb-${autoId}`;

  return (
    <label htmlFor={cbId} className={clsx(styles.root, disabled && styles.disabled, className)}>
      <span className={styles.box}>
        <input
          ref={(el) => {
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
            if (el) el.indeterminate = !!indeterminate;
          }}
          id={cbId}
          type="checkbox"
          disabled={disabled}
          className={styles.input}
          {...rest}
        />
        <span className={styles.indicator} aria-hidden>
          {indeterminate ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
        </span>
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
