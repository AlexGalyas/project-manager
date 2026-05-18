'use client';

import { AlertTriangle, Brain, Clock, Link2 } from 'lucide-react';
import type {
  AssignmentWarningCode,
  AssignmentWarningDto,
} from '@workforce/shared';
import { Modal } from './Modal';
import styles from './AssignmentWarningsModal.module.scss';

interface Props {
  open: boolean;
  warnings: AssignmentWarningDto[];
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  confirmLabel?: string;
}

const ICONS: Record<AssignmentWarningCode, React.ReactNode> = {
  MISSING_SKILLS: <Brain size={16} />,
  OVERLOAD: <Clock size={16} />,
  UNRESOLVED_DEPENDENCIES: <Link2 size={16} />,
};

export function AssignmentWarningsModal({
  open,
  warnings,
  onConfirm,
  onCancel,
  busy,
  confirmLabel = 'Assign anyway',
}: Props) {
  return (
    <Modal
      open={open}
      title="Assignment has issues"
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className={styles.intro}>
        <AlertTriangle size={14} /> The system found issues with this assignment. You can still
        proceed if you want to override.
      </p>
      <ul className={styles.list}>
        {warnings.map((w, i) => (
          <li key={i} className={styles.item}>
            <span className={`${styles.icon} ${styles[`icon_${w.code}`]}`}>
              {ICONS[w.code]}
            </span>
            <span>{w.message}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
