'use client';

import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { Field } from '../Field';
import styles from './Select.module.scss';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  helper?: string;
  error?: string;
  options?: SelectOption[];
  inputSize?: 'sm' | 'md';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id,
    label,
    helper,
    error,
    options,
    inputSize = 'md',
    className,
    required,
    children,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? `select-${autoId}`;

  const control = (
    <div
      className={clsx(
        styles.wrap,
        styles[`size_${inputSize}`],
        error && styles.invalid,
      )}
    >
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={clsx(styles.select, className)}
        {...rest}
      >
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : children}
      </select>
      <ChevronDown size={14} className={styles.chevron} aria-hidden />
    </div>
  );

  if (label || helper || error) {
    return (
      <Field id={selectId} label={label} helper={helper} error={error} required={required}>
        {control}
      </Field>
    );
  }
  return control;
});
