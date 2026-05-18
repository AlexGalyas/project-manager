'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarRange,
  Clock,
  FolderKanban,
  ListTodo,
  TriangleAlert,
} from 'lucide-react';
import type { AssignmentWithRefsDto, WorkloadEntryDto } from '@workforce/shared';
import { assignmentsApi } from '@/lib/api/assignments';
import { workloadApi } from '@/lib/api/workload';
import { toastError } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { PageContainer } from '@/components/layout';
import { Badge, Card, EmptyState, SectionHeader, Skeleton } from '@/components/ui';
import { StatCard } from '@/components/dashboard';
import styles from './page.module.scss';

interface DashboardData {
  assignments: AssignmentWithRefsDto[];
  workload: WorkloadEntryDto;
}

export default function EmployeeDashboard() {
  const me = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([assignmentsApi.list(), workloadApi.me()])
      .then(([assignments, workload]) => setData({ assignments, workload }))
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load dashboard');
      });
  }, []);

  const firstName = me?.fullName.split(' ')[0] ?? 'there';
  const greet = greetingFor(new Date());

  const summary = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const thisWeekEnd = now + weekMs;
    const nextWeekStart = thisWeekEnd;
    const nextWeekEnd = nextWeekStart + weekMs;

    let thisWeek = 0;
    let nextWeek = 0;
    let overdue = 0;
    for (const a of data.assignments) {
      const deadline = a.task.deadline ? new Date(a.task.deadline).getTime() : null;
      if (deadline !== null && deadline < now && a.task.status !== 'DONE') {
        overdue += 1;
      }
      if (deadline !== null && deadline >= now && deadline < thisWeekEnd) {
        thisWeek += a.plannedHours;
      } else if (deadline !== null && deadline >= nextWeekStart && deadline < nextWeekEnd) {
        nextWeek += a.plannedHours;
      }
    }
    return {
      tasks: data.assignments.length,
      thisWeek,
      nextWeek,
      overdue,
    };
  }, [data]);

  const grouped = useMemo(() => {
    if (!data) return null;
    const todo: AssignmentWithRefsDto[] = [];
    const inProgress: AssignmentWithRefsDto[] = [];
    const done: AssignmentWithRefsDto[] = [];
    for (const a of data.assignments) {
      if (a.task.status === 'DONE') done.push(a);
      else if (a.task.status === 'IN_PROGRESS') inProgress.push(a);
      else todo.push(a);
    }
    return { todo, inProgress, done };
  }, [data]);

  return (
    <PageContainer
      title={`${greet}, ${firstName}`}
      description="Your week at a glance — tasks, hours, and what's coming up next."
    >
      {loadError && <p className={styles.error}>{loadError}</p>}

      <div className={styles.statsRow}>
        <StatCard
          label="Tasks assigned"
          value={summary?.tasks ?? null}
          icon={<ListTodo size={16} />}
        />
        <StatCard
          label="Hours this week"
          value={summary ? `${summary.thisWeek}h` : null}
          icon={<Clock size={16} />}
          tone="accent"
        />
        <StatCard
          label="Hours next week"
          value={summary ? `${summary.nextWeek}h` : null}
          icon={<CalendarRange size={16} />}
        />
        <StatCard
          label="Overdue"
          value={summary?.overdue ?? null}
          icon={<TriangleAlert size={16} />}
          tone={summary && summary.overdue > 0 ? 'danger' : 'success'}
        />
      </div>

      <Card padding="lg">
        <SectionHeader
          as="h3"
          title="My tasks"
          description="Grouped by status"
          action={
            <Link href="/employee/tasks" className={styles.viewAll}>
              View all <ArrowUpRight size={12} />
            </Link>
          }
        />
        {!grouped ? (
          <TaskStackSkeleton />
        ) : grouped.todo.length + grouped.inProgress.length + grouped.done.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={20} />}
            title="No assignments yet"
            description="Your manager will assign tasks or run the optimizer. Check back soon."
          />
        ) : (
          <div className={styles.groups}>
            <TaskGroup
              label="In progress"
              tone="accent"
              items={grouped.inProgress}
              dotClass={styles.dotAccent}
            />
            <TaskGroup
              label="To do"
              tone="neutral"
              items={grouped.todo}
              dotClass={styles.dotNeutral}
            />
            <TaskGroup
              label="Done"
              tone="success"
              items={grouped.done}
              dotClass={styles.dotSuccess}
            />
          </div>
        )}
      </Card>
    </PageContainer>
  );
}

function TaskGroup({
  label,
  tone,
  items,
  dotClass,
}: {
  label: string;
  tone: 'neutral' | 'accent' | 'success';
  items: AssignmentWithRefsDto[];
  dotClass: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.group}>
      <header className={styles.groupHeader}>
        <span className={`${styles.groupDot} ${dotClass}`} aria-hidden />
        <h4 className={styles.groupTitle}>{label}</h4>
        <span className={styles.groupCount}>{items.length}</span>
      </header>
      <ul className={styles.taskList}>
        {items.slice(0, 5).map((a) => (
          <li key={a.id} className={styles.taskRow}>
            <span className={styles.taskMain}>
              <span className={styles.taskName}>{a.task.name}</span>
              <span className={styles.taskMeta}>{a.task.projectName}</span>
            </span>
            <span className={styles.taskMeta}>
              {a.task.deadline ? relativeDate(new Date(a.task.deadline)) : '—'} ·{' '}
              <Badge variant={tone === 'success' ? 'success' : 'neutral'} size="sm">
                {a.plannedHours}h
              </Badge>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaskStackSkeleton() {
  return (
    <div className={styles.groups}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={styles.taskRow}>
          <Skeleton width={220} height={16} />
          <Skeleton width={80} height={16} />
        </div>
      ))}
    </div>
  );
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Hi';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeDate(d: Date): string {
  const diffDays = Math.round((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays > 0 && diffDays <= 14) return `in ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -14) return `${Math.abs(diffDays)} days overdue`;
  return d.toLocaleDateString();
}
