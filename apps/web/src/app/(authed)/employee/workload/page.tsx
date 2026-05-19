'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ListTodo, TrendingUp } from 'lucide-react';
import type {
  AssignmentWithRefsDto,
  WorkloadEntryDto,
} from '@workforce/shared';
import { workloadApi } from '@/lib/api/workload';
import { assignmentsApi } from '@/lib/api/assignments';
import {
  bucketAssignmentsByDay,
  cellStatus,
  getCurrentWorkWeek,
  type WeekDay,
} from '@/lib/workload-week';
import { toastError } from '@/stores/ui-store';
import { PageContainer } from '@/components/layout';
import { Badge, Card, EmptyState, SectionHeader, Skeleton } from '@/components/ui';
import { StatCard } from '@/components/dashboard';
import styles from './page.module.scss';

const STATUS_VARIANT: Record<string, 'neutral' | 'accent' | 'success'> = {
  TODO: 'neutral',
  IN_PROGRESS: 'accent',
  DONE: 'success',
};

export default function EmployeeWorkloadPage() {
  const [me, setMe] = useState<WorkloadEntryDto | null>(null);
  const [mine, setMine] = useState<AssignmentWithRefsDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const week = useMemo<WeekDay[]>(() => getCurrentWorkWeek(), []);

  useEffect(() => {
    Promise.all([workloadApi.me(), assignmentsApi.list()])
      .then(([w, a]) => {
        setMe(w);
        setMine(a);
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load your workload');
      });
  }, []);

  const bucketed = useMemo(() => {
    if (!mine || !me) return null;
    const dailyMaxByUser = new Map<string, number>([[me.userId, me.maxHoursPerDay]]);
    return bucketAssignmentsByDay(mine, week, dailyMaxByUser);
  }, [mine, me, week]);

  const ready = me && mine && bucketed;
  const dailyMax = me ? me.maxHoursPerDay : 0;
  const utilization =
    me && me.maxHours > 0 ? Math.round((me.plannedHours / me.maxHours) * 100) : 0;

  const utilizationTone: 'success' | 'warning' | 'danger' | 'accent' = me
    ? me.status === 'over'
      ? 'danger'
      : me.status === 'normal'
        ? 'warning'
        : 'success'
    : 'accent';

  return (
    <PageContainer
      title="My workload"
      description={
        <>
          Per-day hours from your assignments&apos; plannedStart-plannedEnd ranges, front-filled
          at your daily cap of{' '}
          <code className={styles.code}>
            {me ? `${me.maxHoursPerDay}h` : '—'}
          </code>
          .
        </>
      }
    >
      {loadError && <p className={styles.error}>{loadError}</p>}

      <div className={styles.summary}>
        <StatCard
          label="Planned this week"
          value={me ? `${roundTo(me.plannedHours)}h` : null}
          icon={<CalendarDays size={16} />}
        />
        <StatCard label="Weekly cap" value={me ? `${me.maxHours}h` : null} />
        <StatCard
          label="Utilization"
          value={me ? `${utilization}%` : null}
          icon={<TrendingUp size={16} />}
          tone={utilizationTone}
          description={me ? statusExplanation(me.status) : undefined}
        />
      </div>

      {!ready && !loadError && (
        <Card padding="none">
          <div className={styles.skeletonStack}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <Skeleton width={180} height={14} />
                <Skeleton width={'70%'} height={14} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {ready && bucketed!.outsideWeekCount > 0 && (
        <Card padding="md">
          <p className={styles.outsideNote}>
            <TrendingUp size={14} />
            {bucketed!.outsideWeekCount} of your tasks have hours scheduled outside this Mon-Fri
            window.
          </p>
        </Card>
      )}
      {ready && bucketed!.unscheduledCount > 0 && (
        <Card padding="md">
          <p className={styles.outsideNote}>
            <TrendingUp size={14} />
            {bucketed!.unscheduledCount} of your tasks have no plannedStart / plannedEnd yet
            &mdash; ask your manager to re-run the optimizer.
          </p>
        </Card>
      )}

      {ready && mine!.length === 0 && (
        <Card padding="lg">
          <EmptyState
            icon={<ListTodo size={20} />}
            title="No tasks assigned yet"
            description="Once your manager runs the optimizer, your week will appear here."
          />
        </Card>
      )}

      {ready && mine!.length > 0 && (
        <>
          <Card padding="none">
            <div className={styles.tableWrap}>
              <table className={styles.heatmap}>
                <thead>
                  <tr>
                    {week.map((d) => (
                      <th key={d.iso}>
                        <span className={styles.dayLabel}>{d.label}</span>
                        <span className={styles.dayShort}>{d.short}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {week.map((d) => {
                      const h = bucketed!.cells.get(`${me!.userId}|${d.iso}`) ?? 0;
                      const status = cellStatus(h, dailyMax);
                      return (
                        <td
                          key={d.iso}
                          className={`${styles.cell} ${styles[`cell_${status}`]}`}
                          title={`${d.label} ${d.short}: ${h}h (daily max ${Math.round(dailyMax * 10) / 10}h)`}
                        >
                          {h > 0 ? `${roundTo(h)}h` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <ul className={styles.legend}>
            <li>
              <span className={`${styles.swatch} ${styles.cell_under}`} aria-hidden /> Under
              capacity
            </li>
            <li>
              <span className={`${styles.swatch} ${styles.cell_normal}`} aria-hidden /> Near
              capacity
            </li>
            <li>
              <span className={`${styles.swatch} ${styles.cell_over}`} aria-hidden /> Over
              capacity
            </li>
          </ul>

          <Card padding="none">
            <div className={styles.tableHeader}>
              <SectionHeader as="h3" title="My tasks" description="Sorted by deadline" />
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.taskTable}>
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
                  {[...mine!]
                    .sort((a, b) => {
                      const ad = a.task.deadline ?? '9999-12-31';
                      const bd = b.task.deadline ?? '9999-12-31';
                      return ad.localeCompare(bd);
                    })
                    .map((a) => (
                      <tr key={a.id}>
                        <td className={styles.taskName}>{a.task.name}</td>
                        <td className={styles.muted}>{a.task.projectName}</td>
                        <td className={styles.hours}>{a.plannedHours}h</td>
                        <td className={styles.muted}>
                          {a.task.deadline
                            ? new Date(a.task.deadline).toLocaleDateString()
                            : '—'}
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
          </Card>
        </>
      )}
    </PageContainer>
  );
}

function statusExplanation(status: 'under' | 'normal' | 'over'): string {
  if (status === 'over') return 'Planned hours exceed your weekly cap.';
  if (status === 'normal') return '80–100% of weekly cap — comfortably loaded.';
  return 'Less than 80% of weekly cap — room for more.';
}

function roundTo(n: number): number {
  return Math.round(n * 10) / 10;
}
