'use client';

import { useEffect, useState } from 'react';
import type { AssignmentWithRefsDto } from '@workforce/shared';
import { assignmentsApi } from '@/lib/api/assignments';
import { EmptyState } from '@/components/EmptyState';
import styles from './page.module.scss';

export default function EmployeeTasksPage() {
  const [assignments, setAssignments] = useState<AssignmentWithRefsDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    assignmentsApi
      .list()
      .then(setAssignments)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section>
      <h1 className={styles.heading}>My tasks</h1>
      <p className={styles.subtitle}>
        Tasks assigned to you by the optimizer. Status changes are managed by your manager.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {assignments && assignments.length === 0 && (
        <EmptyState
          title="No tasks assigned yet"
          description="The optimizer will populate this list once Phase 4 lands."
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
