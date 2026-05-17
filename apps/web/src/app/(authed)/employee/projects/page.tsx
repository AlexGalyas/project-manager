'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AssignmentWithRefsDto } from '@workforce/shared';
import { assignmentsApi } from '@/lib/api/assignments';
import { toastError } from '@/stores/ui-store';
import { EmptyState } from '@/components/EmptyState';
import { Spinner } from '@/components/Spinner';
import styles from './page.module.scss';

interface ProjectGroup {
  projectId: string;
  projectName: string;
  taskCount: number;
  hours: number;
}

export default function EmployeeProjectsPage() {
  const [assignments, setAssignments] = useState<AssignmentWithRefsDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    assignmentsApi
      .list()
      .then(setAssignments)
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load your projects');
      });
  }, []);

  const projects: ProjectGroup[] = useMemo(() => {
    if (!assignments) return [];
    const byId = new Map<string, ProjectGroup>();
    for (const a of assignments) {
      const existing = byId.get(a.task.projectId);
      if (existing) {
        existing.taskCount += 1;
        existing.hours += a.plannedHours;
      } else {
        byId.set(a.task.projectId, {
          projectId: a.task.projectId,
          projectName: a.task.projectName,
          taskCount: 1,
          hours: a.plannedHours,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.projectName.localeCompare(b.projectName),
    );
  }, [assignments]);

  return (
    <section>
      <h1 className={styles.heading}>My projects</h1>
      <p className={styles.subtitle}>
        Projects you have tasks in, derived from your assignments.
      </p>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {!assignments && !loadError && <Spinner />}

      {assignments && projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="You'll see your projects here once tasks are assigned to you."
        />
      )}

      {projects.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Tasks</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.projectId}>
                  <td className={styles.name}>{p.projectName}</td>
                  <td>{p.taskCount}</td>
                  <td>{p.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
