'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
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
import { EmptyState } from '@/components/EmptyState';
import styles from './page.module.scss';

export default function EmployeeWorkloadPage() {
  const [me, setMe] = useState<WorkloadEntryDto | null>(null);
  const [mine, setMine] = useState<AssignmentWithRefsDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const week = useMemo<WeekDay[]>(() => getCurrentWorkWeek(), []);

  useEffect(() => {
    Promise.all([workloadApi.me(), assignmentsApi.list()])
      .then(([w, a]) => {
        setMe(w);
        setMine(a);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const bucketed = useMemo(() => {
    if (!mine) return null;
    return bucketAssignmentsByDay(mine, week);
  }, [mine, week]);

  if (error) {
    return (
      <section>
        <h1 className={styles.heading}>My workload</h1>
        <p className={styles.error}>{error}</p>
      </section>
    );
  }

  if (!me || !mine || !bucketed) {
    return (
      <section>
        <h1 className={styles.heading}>My workload</h1>
        <p className={styles.muted}>Loading…</p>
      </section>
    );
  }

  const dailyMax = me.maxHours / 5;
  const utilization = me.maxHours > 0 ? Math.round((me.plannedHours / me.maxHours) * 100) : 0;

  return (
    <section className={styles.page}>
      <header>
        <h1 className={styles.heading}>
          <CalendarDays size={20} /> My workload
        </h1>
        <p className={styles.subtitle}>
          Hours from tasks assigned to you, bucketed by their deadline. Daily capacity is{' '}
          <code className={styles.code}>{Math.round(dailyMax * 10) / 10}h</code>.
        </p>
      </header>

      <div className={styles.summary}>
        <SummaryCard label="Planned this week" value={`${roundTo(me.plannedHours)}h`} />
        <SummaryCard label="Cap" value={`${me.maxHours}h`} />
        <SummaryCard label="Utilization" value={`${utilization}%`} kind={me.status} />
      </div>

      <div className={styles.bar}>
        <div
          className={`${styles.barFill} ${styles[`barFill_${me.status}`]}`}
          style={{ width: `${Math.min(100, utilization)}%` }}
        />
      </div>
      <p className={styles.barNote}>
        Status: <strong className={styles[`status_${me.status}`]}>{me.status}</strong>
        {' · '}
        {statusExplanation(me.status)}
      </p>

      {mine.length === 0 ? (
        <EmptyState
          title="No tasks assigned yet"
          description="Once your manager runs the optimizer, your week will appear here."
        />
      ) : (
        <>
          <h2 className={styles.subheading}>My week</h2>
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
                    const h = bucketed.cells.get(`${me.userId}|${d.iso}`) ?? 0;
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

          {bucketed.outsideWeekCount > 0 && (
            <p className={styles.note}>
              {bucketed.outsideWeekCount} of your tasks have a deadline outside this week (no
              deadline, or earlier/later than Mon–Fri).
            </p>
          )}

          <h2 className={styles.subheading}>My tasks</h2>
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
                {[...mine]
                  .sort((a, b) => {
                    const ad = a.task.deadline ?? '9999-12-31';
                    const bd = b.task.deadline ?? '9999-12-31';
                    return ad.localeCompare(bd);
                  })
                  .map((a) => (
                    <tr key={a.id}>
                      <td className={styles.taskName}>{a.task.name}</td>
                      <td className={styles.muted}>{a.task.projectName}</td>
                      <td>{a.plannedHours}h</td>
                      <td className={styles.muted}>
                        {a.task.deadline ? new Date(a.task.deadline).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <span className={`${styles.taskStatus} ${styles[`taskStatus_${a.task.status}`]}`}>
                          {a.task.status.toLowerCase().replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
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
  kind?: 'under' | 'normal' | 'over';
}) {
  return (
    <article className={`${styles.card} ${kind ? styles[`card_${kind}`] : ''}`}>
      <span className={styles.cardLabel}>{label}</span>
      <strong className={styles.cardValue}>{value}</strong>
    </article>
  );
}

function statusExplanation(status: 'under' | 'normal' | 'over'): string {
  if (status === 'over') return 'planned hours exceed your weekly cap.';
  if (status === 'normal') return '80–100% of your weekly cap — comfortably loaded.';
  return 'less than 80% of your weekly cap — room for more.';
}

function roundTo(n: number): number {
  return Math.round(n * 10) / 10;
}
