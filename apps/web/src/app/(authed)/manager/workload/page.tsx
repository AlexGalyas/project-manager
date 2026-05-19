'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  TrendingUp,
  TriangleAlert,
  Users,
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
import { Avatar, Button, Card, EmptyState, SectionHeader, Skeleton } from '@/components/ui';
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

export default function ManagerWorkloadPage() {
  const [entries, setEntries] = useState<WorkloadEntryDto[] | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithRefsDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // weekOffset = 0 → current Mon-Fri week, -1 = previous, +1 = next, etc.
  const [weekOffset, setWeekOffset] = useState(0);

  const week = useMemo<WeekDay[]>(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return getCurrentWorkWeek(d);
  }, [weekOffset]);

  useEffect(() => {
    Promise.all([workloadApi.list(), assignmentsApi.list()])
      .then(([w, a]) => {
        setEntries(w);
        setAssignments(a);
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load workload');
      });
  }, []);

  const dailyMaxByUser = useMemo(() => {
    const m = new Map<string, number>();
    entries?.forEach((e) => m.set(e.userId, e.maxHoursPerDay));
    return m;
  }, [entries]);

  const bucketed = useMemo(() => {
    if (!assignments || !entries) return null;
    return bucketAssignmentsByDay(assignments, week, dailyMaxByUser);
  }, [assignments, entries, week, dailyMaxByUser]);

  // The /api/workload entries report 'this calendar week'. When the user
  // navigates to another week we recompute planned hours + status on the
  // client by summing the heatmap cells for the displayed week.
  const perWeek = useMemo(() => {
    if (!entries || !bucketed) return null;
    const hours = new Map<string, number>();
    const status = new Map<string, WorkloadStatus>();
    for (const e of entries) {
      let sum = 0;
      for (const d of week) {
        sum += bucketed.cells.get(`${e.userId}|${d.iso}`) ?? 0;
      }
      hours.set(e.userId, sum);
      status.set(e.userId, statusForHours(sum, e.maxHours));
    }
    return { hours, status };
  }, [entries, bucketed, week]);

  const summary = useMemo(() => {
    if (!entries || !perWeek) return null;
    const total = entries.reduce((s, e) => s + (perWeek.hours.get(e.userId) ?? 0), 0);
    const capacity = entries.reduce((s, e) => s + e.maxHours, 0);
    let overloaded = 0;
    let normal = 0;
    let under = 0;
    for (const e of entries) {
      const s = perWeek.status.get(e.userId) ?? 'normal';
      if (s === 'over') overloaded += 1;
      else if (s === 'normal') normal += 1;
      else under += 1;
    }
    return {
      total,
      capacity,
      overloaded,
      normal,
      under,
      utilization: capacity > 0 ? Math.round((total / capacity) * 100) : 0,
    };
  }, [entries, perWeek]);

  if (loadError) {
    return (
      <PageContainer title="Team workload">
        <p className={styles.error}>{loadError}</p>
      </PageContainer>
    );
  }

  if (entries && entries.length === 0) {
    return (
      <PageContainer title="Team workload">
        <EmptyState
          icon={<Users size={20} />}
          title="No employees in this organization"
          description="Seed the database to populate the demo."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Team workload"
      description={
        <>
          Per-day hours from each assignment&apos;s plannedStart-plannedEnd range,
          front-filled at the employee&apos;s{' '}
          <code className={styles.code}>maxHoursPerDay</code>. Run the optimizer to populate
          assignments.
        </>
      }
    >
      <div className={styles.summary}>
        <StatCard
          label="Planned"
          value={summary ? `${roundTo(summary.total)}h` : null}
          icon={<CalendarRange size={16} />}
        />
        <StatCard
          label="Capacity"
          value={summary ? `${summary.capacity}h` : null}
          icon={<Users size={16} />}
        />
        <StatCard
          label="Utilization"
          value={summary ? `${summary.utilization}%` : null}
          tone="accent"
        />
        <StatCard
          label="Overloaded"
          value={summary?.overloaded ?? null}
          icon={<TriangleAlert size={16} />}
          tone={summary && summary.overloaded > 0 ? 'danger' : 'success'}
        />
        <StatCard label="At capacity" value={summary?.normal ?? null} tone="warning" />
        <StatCard label="Under" value={summary?.under ?? null} tone="success" />
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

      {bucketed && bucketed.outsideWeekCount > 0 && (
        <Card padding="md" className={styles.outsideNote}>
          <TrendingUp size={14} />
          <span>
            {bucketed.outsideWeekCount} assignment
            {bucketed.outsideWeekCount === 1 ? '' : 's'} have hours scheduled outside this Mon-Fri
            window. Navigate to the surrounding weeks to see them.
          </span>
        </Card>
      )}
      {bucketed && bucketed.unscheduledCount > 0 && (
        <Card padding="md" className={styles.outsideNote}>
          <TriangleAlert size={14} />
          <span>
            {bucketed.unscheduledCount} assignment
            {bucketed.unscheduledCount === 1 ? '' : 's'} have no plannedStart / plannedEnd yet.
            Re-run the optimizer with &quot;Re-optimize everything&quot; to schedule them.
          </span>
        </Card>
      )}

      <Card padding="none">
        {!entries || !bucketed || !perWeek ? (
          <div className={styles.skeletonStack}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <Skeleton circle width={24} height={24} />
                <Skeleton width={160} height={14} />
                <Skeleton width="100%" height={32} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.heatmap}>
              <thead>
                <tr>
                  <th className={styles.nameCol}>Employee</th>
                  {week.map((d) => (
                    <th key={d.iso} className={styles.dayCol}>
                      <span className={styles.dayLabel}>{d.label}</span>
                      <span className={styles.dayShort}>{d.short}</span>
                    </th>
                  ))}
                  <th className={styles.totalCol}>Week</th>
                  <th>Cap</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const dailyMax = e.maxHoursPerDay;
                  const weekHours = perWeek.hours.get(e.userId) ?? 0;
                  const weekStatus = perWeek.status.get(e.userId) ?? 'normal';
                  return (
                    <tr key={e.userId}>
                      <td className={styles.nameCol}>
                        <span className={styles.identity}>
                          <Avatar name={e.fullName} size="xs" />
                          <span>{e.fullName}</span>
                        </span>
                      </td>
                      {week.map((d) => {
                        const h = bucketed.cells.get(`${e.userId}|${d.iso}`) ?? 0;
                        const status = cellStatus(h, dailyMax);
                        return (
                          <td
                            key={d.iso}
                            className={`${styles.cell} ${styles[`cell_${status}`]}`}
                            title={`${e.fullName} · ${d.label} ${d.short}: ${h}h (daily max ${Math.round(dailyMax * 10) / 10}h)`}
                          >
                            {h > 0 ? `${roundTo(h)}h` : ''}
                          </td>
                        );
                      })}
                      <td className={`${styles.totalCol} ${styles[`total_${weekStatus}`]}`}>
                        {roundTo(weekHours)}h
                      </td>
                      <td className={styles.muted}>{e.maxHours}h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SectionHeader as="h3" title="Legend" />
      <ul className={styles.legend}>
        <li>
          <span className={`${styles.swatch} ${styles.cell_under}`} aria-hidden />
          ≤ 80% of daily cap
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.cell_normal}`} aria-hidden />
          80–100% of daily cap
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.cell_over}`} aria-hidden />
          &gt; 100% (overloaded)
        </li>
      </ul>
    </PageContainer>
  );
}

function roundTo(n: number): number {
  return Math.round(n * 10) / 10;
}
