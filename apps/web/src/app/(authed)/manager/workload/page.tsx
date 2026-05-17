'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, TrendingUp } from 'lucide-react';
import type { AssignmentWithRefsDto, WorkloadEntryDto } from '@workforce/shared';
import { workloadApi } from '@/lib/api/workload';
import { assignmentsApi } from '@/lib/api/assignments';
import {
  bucketAssignmentsByDay,
  cellStatus,
  getCurrentWorkWeek,
  type WeekDay,
} from '@/lib/workload-week';
import { EmptyState } from '@/components/EmptyState';
import styles from './page.module.scss';

export default function ManagerWorkloadPage() {
  const [entries, setEntries] = useState<WorkloadEntryDto[] | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithRefsDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Capture "now" once so the table doesn't flicker between renders.
  const week = useMemo<WeekDay[]>(() => getCurrentWorkWeek(), []);

  useEffect(() => {
    Promise.all([workloadApi.list(), assignmentsApi.list()])
      .then(([w, a]) => {
        setEntries(w);
        setAssignments(a);
      })
      .catch((e: Error) => setError(e.message));
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
    return { total, capacity, overloaded, normal, under };
  }, [entries]);

  if (error) {
    return (
      <section>
        <h1 className={styles.heading}>Team workload</h1>
        <p className={styles.error}>{error}</p>
      </section>
    );
  }

  if (!entries || !bucketed) {
    return (
      <section>
        <h1 className={styles.heading}>Team workload</h1>
        <p className={styles.muted}>Loading…</p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section>
        <h1 className={styles.heading}>Team workload</h1>
        <EmptyState
          title="No employees in this organization"
          description="Seed the database to populate the demo."
        />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header>
        <h1 className={styles.heading}>
          <CalendarDays size={20} /> Team workload
        </h1>
        <p className={styles.subtitle}>
          Hours bucketed by task deadline for the current work week. Daily capacity is{' '}
          <code className={styles.code}>maxHoursPerWeek / 5</code>. Run the optimizer to populate
          assignments.
        </p>
      </header>

      {summary && (
        <div className={styles.summary}>
          <SummaryCard label="Planned" value={`${summary.total}h`} />
          <SummaryCard label="Capacity" value={`${summary.capacity}h`} />
          <SummaryCard
            label="Utilization"
            value={`${Math.round((summary.total / summary.capacity) * 100)}%`}
          />
          <SummaryCard label="Overloaded" value={summary.overloaded} kind={summary.overloaded > 0 ? 'over' : undefined} />
          <SummaryCard label="At capacity" value={summary.normal} />
          <SummaryCard label="Under" value={summary.under} />
        </div>
      )}

      {bucketed.outsideWeekCount > 0 && (
        <p className={styles.note}>
          <TrendingUp size={14} /> {bucketed.outsideWeekCount} assignment
          {bucketed.outsideWeekCount === 1 ? '' : 's'} have a deadline outside this week (no deadline,
          or earlier/later than Mon–Fri). They count toward weekly totals but aren&apos;t shown in
          the table.
        </p>
      )}

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
                    <span>{e.fullName}</span>
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

      <Legend />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  kind,
}: {
  label: string;
  value: string | number;
  kind?: 'over';
}) {
  return (
    <article className={`${styles.card} ${kind ? styles[`card_${kind}`] : ''}`}>
      <span className={styles.cardLabel}>{label}</span>
      <strong className={styles.cardValue}>{value}</strong>
    </article>
  );
}

function Legend() {
  return (
    <ul className={styles.legend}>
      <li>
        <span className={`${styles.swatch} ${styles.cell_under}`} /> ≤ 80% of daily cap
      </li>
      <li>
        <span className={`${styles.swatch} ${styles.cell_normal}`} /> 80–100% of daily cap
      </li>
      <li>
        <span className={`${styles.swatch} ${styles.cell_over}`} /> &gt; 100% (overloaded)
      </li>
    </ul>
  );
}

function roundTo(n: number): number {
  return Math.round(n * 10) / 10;
}
