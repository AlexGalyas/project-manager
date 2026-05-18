'use client';

import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import { Field } from '../Field';
import styles from './Input.module.scss';

export type InputSize = 'sm' | 'md';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helper?: string;
  error?: string;
  inputSize?: InputSize;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    helper,
    error,
    inputSize = 'md',
    leftIcon,
    rightSlot,
    className,
    required,
    type = 'text',
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `input-${autoId}`;

  const control = (
    <div
      className={clsx(
        styles.wrap,
        styles[`size_${inputSize}`],
        leftIcon && styles.hasLeftIcon,
        rightSlot && styles.hasRightSlot,
        error && styles.invalid,
      )}
    >
      {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
      <input
        ref={ref}
        id={inputId}
        type={type}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
        className={clsx(styles.input, className)}
        {...rest}
      />
      {rightSlot && <span className={styles.rightSlot}>{rightSlot}</span>}
    </div>
  );

  if (label || helper || error) {
    return (
      <Field id={inputId} label={label} helper={helper} error={error} required={required}>
        {control}
      </Field>
    );
  }
  return control;
});
