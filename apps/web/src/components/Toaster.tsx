'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useUIStore, type ToastKind } from '@/stores/ui-store';
import styles from './Toaster.module.scss';

const ICONS: Record<ToastKind, React.ReactNode> = {
  info: <Info size={16} />,
  success: <CheckCircle2 size={16} />,
  error: <XCircle size={16} />,
};

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack} role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[`toast_${t.kind}`]}`}>
          <span className={styles.icon}>{ICONS[t.kind]}</span>
          <span className={styles.message}>{t.message}</span>
          <button
            type="button"
            className={styles.close}
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
