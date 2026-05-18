'use client';

import { useEffect, useMemo, useState } from 'react';
import { FolderKanban } from 'lucide-react';
import type { AssignmentWithRefsDto } from '@workforce/shared';
import { assignmentsApi } from '@/lib/api/assignments';
import { toastError } from '@/stores/ui-store';
import { PageContainer } from '@/components/layout';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui';
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

  const projects: ProjectGroup[] | null = useMemo(() => {
    if (!assignments) return null;
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

  const description = projects
    ? `${projects.length} project${projects.length === 1 ? '' : 's'} with work assigned to you`
    : loadError
      ? 'Could not load projects'
      : 'Loading…';

  return (
    <PageContainer title="My projects" description={description}>
      {loadError && <p className={styles.error}>{loadError}</p>}

      <Card padding="none">
        {!projects && !loadError && (
          <div className={styles.skeletonStack}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <Skeleton width={220} height={14} />
                <Skeleton width={60} height={14} />
                <Skeleton width={60} height={14} />
              </div>
            ))}
          </div>
        )}

        {projects && projects.length === 0 && (
          <EmptyState
            icon={<FolderKanban size={20} />}
            title="No projects yet"
            description="You'll see your projects here once tasks are assigned to you."
          />
        )}

        {projects && projects.length > 0 && (
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
                    <td>
                      <Badge variant="neutral" size="sm">
                        {p.taskCount}
                      </Badge>
                    </td>
                    <td className={styles.hours}>{p.hours}h</td>
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
