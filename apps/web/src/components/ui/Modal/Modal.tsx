'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import styles from './Modal.module.scss';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  /** Optional title rendered in the header. If omitted, render your own header inside children. */
  title?: React.ReactNode;
  /** Disable outside-click and Esc dismissal (use for critical confirmations). */
  dismissOnOverlay?: boolean;
  /** Element id used for aria-labelledby; auto-generated if omitted. */
  ariaLabelledBy?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  size = 'md',
  title,
  dismissOnOverlay = true,
  ariaLabelledBy,
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissOnOverlay) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, dismissOnOverlay]);

  if (!open || typeof document === 'undefined') return null;

  const titleId = ariaLabelledBy ?? 'modal-title';

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (dismissOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={clsx(styles.dialog, styles[`size_${size}`], className)}
      >
        {title && (
          <ModalHeader>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </ModalHeader>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx(styles.header, className)} {...rest} />;
}

export function ModalBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx(styles.body, className)} {...rest} />;
}

export function ModalFooter({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx(styles.footer, className)} {...rest} />;
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
