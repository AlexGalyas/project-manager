'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ListTodo, FolderKanban, Clock } from 'lucide-react';
import type { AssignmentWithRefsDto } from '@workforce/shared';
import { assignmentsApi } from '@/lib/api/assignments';
import { toastError } from '@/stores/ui-store';
import styles from './page.module.scss';

export default function EmployeeDashboard() {
  const [assignments, setAssignments] = useState<AssignmentWithRefsDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    assignmentsApi
      .list()
      .then(setAssignments)
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load your tasks');
      });
  }, []);

  const taskCount = assignments?.length ?? null;
  const totalHours = assignments?.reduce((s, a) => s + a.plannedHours, 0) ?? null;
  const projectCount =
    assignments && new Set(assignments.map((a) => a.task.projectId)).size;

  return (
    <section>
      <h1 className={styles.heading}>My dashboard</h1>
      <p className={styles.subtitle}>
        Tasks assigned to you. Once your manager runs the optimizer your work will appear here.
      </p>

      {loadError && <p className={styles.error}>{loadError}</p>}

      <div className={styles.cards}>
        <Stat icon={<ListTodo size={18} />} label="My tasks" value={taskCount} />
        <Stat icon={<Clock size={18} />} label="Planned hours" value={totalHours} />
        <Stat icon={<FolderKanban size={18} />} label="My projects" value={projectCount} />
      </div>

      <div className={styles.cta}>
        <Link href="/employee/tasks" className={styles.ctaBtn}>
          See my tasks →
        </Link>
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
}) {
  return (
    <article className={styles.card}>
      <div className={styles.cardIcon}>{icon}</div>
      <div>
        <span className={styles.cardLabel}>{label}</span>
        <strong className={styles.cardValue}>{value ?? '—'}</strong>
      </div>
    </article>
  );
}
