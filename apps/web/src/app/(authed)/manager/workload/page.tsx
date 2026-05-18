'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, TrendingUp, TriangleAlert, Users } from 'lucide-react';
import type { AssignmentWithRefsDto, WorkloadEntryDto } from '@workforce/shared';
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
import { Avatar, Card, EmptyState, SectionHeader, Skeleton } from '@/components/ui';
import { StatCard } from '@/components/dashboard';
import styles from './page.module.scss';

export default function ManagerWorkloadPage() {
  const [entries, setEntries] = useState<WorkloadEntryDto[] | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithRefsDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const week = useMemo<WeekDay[]>(() => getCurrentWorkWeek(), []);

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

  const bucketed = useMemo(() => {
    if (!assignments) return null;
    return bucketAssignmentsByDay(assignments, week);
  }, [assignments, week]);

  const summary = useMemo(() => {
    if (!entries) return null;
    const total = entries.reduce((s, e) => s + e.plannedHours, 0);
    const capacity = entries.reduce((s, e) => s + e.maxHours, 0);
    const overloaded = entries.filter((e) => e.status === 'over').length;
    const normal = entries.filter((e) => e.status === 'normal').length;
    const under = entries.filter((e) => e.status === 'under').length;
    return {
      total,
      capacity,
      overloaded,
      normal,
      under,
      utilization: capacity > 0 ? Math.round((total / capacity) * 100) : 0,
    };
  }, [entries]);

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
          Hours bucketed by task deadline for the current work week. Daily capacity is{' '}
          <code className={styles.code}>maxHoursPerWeek / 5</code>. Run the optimizer to populate
          assignments.
        </>
      }
    >
      <div className={styles.summary}>
        <StatCard
          label="Planned"
          value={summary ? `${summary.total}h` : null}
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

      {bucketed && bucketed.outsideWeekCount > 0 && (
        <Card padding="md" className={styles.outsideNote}>
          <TrendingUp size={14} />
          <span>
            {bucketed.outsideWeekCount} assignment
            {bucketed.outsideWeekCount === 1 ? '' : 's'} have a deadline outside this week (no
            deadline, or earlier/later than Mon–Fri). They count toward weekly totals but aren&apos;t
            shown in the table.
          </span>
        </Card>
      )}

      <Card padding="none">
        {!entries || !bucketed ? (
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
                  const dailyMax = e.maxHours / 5;
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
                      <td className={`${styles.totalCol} ${styles[`total_${e.status}`]}`}>
                        {roundTo(e.plannedHours)}h
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
