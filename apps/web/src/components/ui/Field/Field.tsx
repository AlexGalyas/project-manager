'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Field.module.scss';

export interface FieldProps {
  id?: string;
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  /** Pass the input/textarea/select element as children. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Layout shell for form controls: label above, control in the middle,
 * helper/error below. The actual input lives in `children`; consumers
 * pass `id` to wire it up to the <label htmlFor>. Used internally by
 * Input/Textarea/Select but exposed for custom controls (e.g. SkillsSelect).
 */
export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { id, label, helper, error, required, children, className },
  ref,
) {
  return (
    <div ref={ref} className={clsx(styles.field, error && styles.hasError, className)}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : helper ? (
        <span className={styles.helper}>{helper}</span>
      ) : null}
    </div>
  );
});
