'use client';

import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import { Field } from '../Field';
import styles from './Textarea.module.scss';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, helper, error, className, required, rows = 3, ...rest },
  ref,
) {
  const autoId = useId();
  const taId = id ?? `textarea-${autoId}`;

  const control = (
    <textarea
      ref={ref}
      id={taId}
      rows={rows}
      required={required}
      aria-invalid={error ? true : undefined}
      className={clsx(styles.textarea, error && styles.invalid, className)}
      {...rest}
    />
  );

  if (label || helper || error) {
    return (
      <Field id={taId} label={label} helper={helper} error={error} required={required}>
        {control}
      </Field>
    );
  }
  return control;
});
