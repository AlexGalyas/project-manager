'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';
import type {
  AssignmentWithRefsDto,
  WorkloadEntryDto,
  WorkloadStatus,
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
import { Badge, Button, Card, EmptyState, SectionHeader, Skeleton } from '@/components/ui';
import { StatCard } from '@/components/dashboard';
import styles from './page.module.scss';

function statusForHours(planned: number, maxPerWeek: number): WorkloadStatus {
  if (maxPerWeek <= 0) return 'normal';
  if (planned > maxPerWeek) return 'over';
  if (planned >= maxPerWeek * 0.8) return 'normal';
  return 'under';
}

function formatWeekLabel(week: WeekDay[]): string {
  if (week.length === 0) return '';
  const first = week[0]!.date;
  const last = week[week.length - 1]!.date;
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (first.getFullYear() !== last.getFullYear()) {
    return `${fmt(first)}, ${first.getFullYear()} – ${fmt(last)}, ${last.getFullYear()}`;
  }
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.getDate()}, ${first.getFullYear()}`;
  }
  return `${fmt(first)} – ${fmt(last)}, ${first.getFullYear()}`;
}

const STATUS_VARIANT: Record<string, 'neutral' | 'accent' | 'success'> = {
  TODO: 'neutral',
  IN_PROGRESS: 'accent',
  DONE: 'success',
};

export default function EmployeeWorkloadPage() {
  const [me, setMe] = useState<WorkloadEntryDto | null>(null);
  const [mine, setMine] = useState<AssignmentWithRefsDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [weekOffset, setWeekOffset] = useState(0);
  const week = useMemo<WeekDay[]>(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return getCurrentWorkWeek(d);
  }, [weekOffset]);

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

  // Recompute planned hours for the DISPLAYED week (the API only ships
  // current-week totals, so navigating to another week needs the client
  // to sum heatmap cells).
  const weekPlanned = useMemo(() => {
    if (!me || !bucketed) return 0;
    let sum = 0;
    for (const d of week) {
      sum += bucketed.cells.get(`${me.userId}|${d.iso}`) ?? 0;
    }
    return sum;
  }, [me, bucketed, week]);
  const weekStatus: WorkloadStatus = me ? statusForHours(weekPlanned, me.maxHours) : 'normal';
  const utilization = me && me.maxHours > 0 ? Math.round((weekPlanned / me.maxHours) * 100) : 0;

  const utilizationTone: 'success' | 'warning' | 'danger' | 'accent' = me
    ? weekStatus === 'over'
      ? 'danger'
      : weekStatus === 'normal'
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
          label={weekOffset === 0 ? 'Planned this week' : 'Planned (this view)'}
          value={ready ? `${roundTo(weekPlanned)}h` : null}
          icon={<CalendarDays size={16} />}
        />
        <StatCard label="Weekly cap" value={me ? `${me.maxHours}h` : null} />
        <StatCard
          label="Utilization"
          value={ready ? `${utilization}%` : null}
          icon={<TrendingUp size={16} />}
          tone={utilizationTone}
          description={ready ? statusExplanation(weekStatus) : undefined}
        />
      </div>

      <div className={styles.weekNav} role="group" aria-label="Week navigation">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leftIcon={<ChevronLeft size={14} />}
          onClick={() => setWeekOffset((w) => w - 1)}
          aria-label="Previous week"
        >
          Previous
        </Button>
        <div className={styles.weekLabelGroup}>
          <span className={styles.weekLabel}>{formatWeekLabel(week)}</span>
          {weekOffset === 0 ? (
            <span className={styles.weekBadge}>This week</span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw size={12} />}
              onClick={() => setWeekOffset(0)}
            >
              Back to this week
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          rightIcon={<ChevronRight size={14} />}
          onClick={() => setWeekOffset((w) => w + 1)}
          aria-label="Next week"
        >
          Next
        </Button>
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
