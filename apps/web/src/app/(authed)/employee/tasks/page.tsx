'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ListTodo } from 'lucide-react';
import type { AssignmentWithRefsDto } from '@workforce/shared';
import { assignmentsApi } from '@/lib/api/assignments';
import { toastError } from '@/stores/ui-store';
import { PageContainer } from '@/components/layout';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui';
import styles from './page.module.scss';

const STATUS_VARIANT: Record<string, 'neutral' | 'accent' | 'success'> = {
  TODO: 'neutral',
  IN_PROGRESS: 'accent',
  DONE: 'success',
};

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

  const sorted = useMemo(() => {
    if (!assignments) return null;
    return [...assignments].sort((a, b) => {
      const ad = a.task.deadline ?? '9999-12-31';
      const bd = b.task.deadline ?? '9999-12-31';
      return ad.localeCompare(bd);
    });
  }, [assignments]);

  const description = assignments
    ? `${assignments.length} task${assignments.length === 1 ? '' : 's'} assigned to you`
    : loadError
      ? 'Could not load tasks'
      : 'Loading…';

  return (
    <PageContainer title="My tasks" description={description}>
      {loadError && <p className={styles.error}>{loadError}</p>}

      <Card padding="none">
        {!sorted && !loadError && (
          <div className={styles.skeletonStack}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <Skeleton width={220} height={14} />
                <Skeleton width={140} height={14} />
                <Skeleton width={60} height={14} />
                <Skeleton width={100} height={14} />
              </div>
            ))}
          </div>
        )}

        {sorted && sorted.length === 0 && (
          <EmptyState
            icon={<ListTodo size={20} />}
            title="No tasks assigned yet"
            description="Your tasks will appear here once your manager runs the optimizer."
          />
        )}

        {sorted && sorted.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Hours</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.id}>
                    <td className={styles.name}>{a.task.name}</td>
                    <td className={styles.muted}>{a.task.projectName}</td>
                    <td className={styles.hours}>{a.plannedHours}h</td>
                    <td className={styles.muted}>
                      {a.task.deadline ? (
                        <span className={styles.deadlineCell}>
                          <CalendarDays size={12} />
                          {new Date(a.task.deadline).toLocaleDateString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Badge variant={STATUS_VARIANT[a.task.status] ?? 'neutral'} size="sm">
                        {a.task.status.toLowerCase().replace('_', ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
