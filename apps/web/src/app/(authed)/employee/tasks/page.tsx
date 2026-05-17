'use client';

import { useEffect, useState } from 'react';
import type { AssignmentWithRefsDto } from '@workforce/shared';
import { assignmentsApi } from '@/lib/api/assignments';
import { toastError } from '@/stores/ui-store';
import { EmptyState } from '@/components/EmptyState';
import { Spinner } from '@/components/Spinner';
import styles from './page.module.scss';

export default function EmployeeTasksPage() {
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

  return (
    <section>
      <h1 className={styles.heading}>My tasks</h1>
      <p className={styles.subtitle}>
        Tasks assigned to you by the optimizer. Status changes are managed by your manager.
      </p>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {!assignments && !loadError && <Spinner />}

      {assignments && assignments.length === 0 && (
        <EmptyState
          title="No tasks assigned yet"
          description="Your tasks will appear here once your manager runs the optimizer."
        />
      )}

      {assignments && assignments.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Hours</th>
                <th>Planned start</th>
                <th>Planned end</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className={styles.name}>{a.task.name}</td>
                  <td className={styles.muted}>{a.task.projectName}</td>
                  <td>{a.plannedHours}</td>
                  <td className={styles.muted}>
                    {a.plannedStart ? new Date(a.plannedStart).toLocaleDateString() : '—'}
                  </td>
                  <td className={styles.muted}>
                    {a.plannedEnd ? new Date(a.plannedEnd).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
