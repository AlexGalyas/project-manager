'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Card.module.scss';

export type CardVariant = 'default' | 'interactive' | 'elevated';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  as?: 'div' | 'section' | 'article' | 'a';
  href?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'md', as = 'div', className, children, ...rest },
  ref,
) {
  const Tag = as as 'div';
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={clsx(
        styles.root,
        styles[`variant_${variant}`],
        styles[`pad_${padding}`],
        className,
      )}
      {...(rest as React.HTMLAttributes<HTMLDivElement>)}
    >
      {children}
    </Tag>
  );
});

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...rest }, ref) {
    return <div ref={ref} className={clsx(styles.header, className)} {...rest} />;
  },
);

export const CardBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardBody({ className, ...rest }, ref) {
    return <div ref={ref} className={clsx(styles.body, className)} {...rest} />;
  },
);

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...rest }, ref) {
    return <div ref={ref} className={clsx(styles.footer, className)} {...rest} />;
  },
);
