'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  FolderKanban,
  ListTodo,
  Sparkles,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type {
  AssignmentWithRefsDto,
  ProjectDto,
  WorkloadEntryDto,
} from '@workforce/shared';
import { projectsApi } from '@/lib/api/projects';
import { workloadApi } from '@/lib/api/workload';
import { assignmentsApi } from '@/lib/api/assignments';
import { toastError } from '@/stores/ui-store';
import { PageContainer } from '@/components/layout';
import { Avatar, Badge, Button, Card, EmptyState, SectionHeader, Skeleton } from '@/components/ui';
import { StatCard } from '@/components/dashboard';
import styles from './page.module.scss';

interface DashboardData {
  projects: ProjectDto[];
  workload: WorkloadEntryDto[];
  assignments: AssignmentWithRefsDto[];
}

export default function ManagerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([projectsApi.list(), workloadApi.list(), assignmentsApi.list()])
      .then(([projects, workload, assignments]) =>
        setData({ projects, workload, assignments }),
      )
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load dashboard');
      });
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const totalTasks = data.projects.reduce((s, p) => s + p.taskCount, 0);
    const unassignedTasks = totalTasks - data.assignments.length;
    const overloaded = data.workload.filter((w) => w.status === 'over').length;
    const avg =
      data.workload.length > 0
        ? data.workload.reduce((s, w) => s + w.plannedHours, 0) / data.workload.length
        : 0;
    return {
      projects: data.projects.length,
      unassignedTasks: Math.max(0, unassignedTasks),
      teamAvg: Math.round(avg * 10) / 10,
      overloaded,
      tasksByStatus: countStatuses(data.assignments),
      loadByEmployee: data.workload,
    };
  }, [data]);

  return (
    <PageContainer
      title="Manager dashboard"
      description="Plan projects, run the optimizer, and watch the team's weekly load."
      actions={
        <Link href="/manager/projects" className={styles.primaryCta}>
          <Button size="md" rightIcon={<ArrowUpRight size={14} />}>
            Open projects
          </Button>
        </Link>
      }
    >
      {loadError && <p className={styles.error}>{loadError}</p>}

      <div className={styles.statsRow}>
        <StatCard
          label="My projects"
          value={stats?.projects ?? null}
          icon={<FolderKanban size={16} />}
        />
        <StatCard
          label="Unassigned tasks"
          value={stats?.unassignedTasks ?? null}
          icon={<ListTodo size={16} />}
          tone={stats && stats.unassignedTasks > 0 ? 'warning' : 'success'}
          description={
            stats
              ? stats.unassignedTasks > 0
                ? 'Run the optimizer to fill them'
                : 'All scheduled'
              : undefined
          }
        />
        <StatCard
          label="Team avg load"
          value={stats ? `${stats.teamAvg}h` : null}
          icon={<Users size={16} />}
          tone="accent"
        />
        <StatCard
          label="Overloaded"
          value={stats?.overloaded ?? null}
          icon={<TriangleAlert size={16} />}
          tone={stats && stats.overloaded > 0 ? 'danger' : 'success'}
          description={stats && stats.overloaded > 0 ? '> 100% of cap' : 'All within cap'}
        />
      </div>

      <div className={styles.widgets}>
        <Card padding="lg" className={styles.widget}>
          <SectionHeader
            as="h3"
            title="Workload distribution"
            description="Hours per employee · this week"
          />
          {stats ? <MiniLoadBars rows={stats.loadByEmployee} /> : <ChartSkeleton />}
        </Card>
        <Card padding="lg" className={styles.widget}>
          <SectionHeader
            as="h3"
            title="Task status"
            description="Across all assignments"
          />
          {stats ? (
            <StatusBreakdown
              todo={stats.tasksByStatus.todo}
              inProgress={stats.tasksByStatus.inProgress}
              done={stats.tasksByStatus.done}
            />
          ) : (
            <ChartSkeleton />
          )}
        </Card>
      </div>

      <Card padding="lg">
        <SectionHeader
          as="h3"
          title="Projects"
          description="Sorted by priority"
          action={
            <Link href="/manager/projects" className={styles.viewAll}>
              View all <ArrowUpRight size={12} />
            </Link>
          }
        />
        {!data ? (
          <div className={styles.projectsList}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.projectRowSkeleton}>
                <Skeleton width={200} height={16} />
                <Skeleton width={60} height={16} />
              </div>
            ))}
          </div>
        ) : data.projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={20} />}
            title="No projects yet"
            description="Create your first project to start assigning tasks."
            action={
              <Link href="/manager/projects">
                <Button leftIcon={<Sparkles size={14} />}>Go to projects</Button>
              </Link>
            }
          />
        ) : (
          <ul className={styles.projectsList}>
            {[...data.projects]
              .sort((a, b) => b.priority - a.priority)
              .slice(0, 6)
              .map((p) => (
                <li key={p.id}>
                  <Link href={`/manager/projects/${p.id}`} className={styles.projectRow}>
                    <span className={styles.projectMain}>
                      <span className={styles.projectName}>{p.name}</span>
                      {p.description && (
                        <span className={styles.projectDesc}>{p.description}</span>
                      )}
                    </span>
                    <span className={styles.projectMeta}>
                      <Badge variant={priorityVariant(p.priority)} size="sm">
                        P{p.priority}
                      </Badge>
                      <span className={styles.projectTasks}>{p.taskCount} tasks</span>
                      <ArrowUpRight size={14} className={styles.arrow} aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}

function priorityVariant(p: number): 'neutral' | 'accent' | 'warning' | 'danger' {
  if (p >= 5) return 'danger';
  if (p === 4) return 'warning';
  if (p === 3) return 'accent';
  return 'neutral';
}

function MiniLoadBars({ rows }: { rows: WorkloadEntryDto[] }) {
  if (rows.length === 0) {
    return (
      <p className={styles.muted}>
        No employees in this organization yet. Run the optimizer once data is seeded.
      </p>
    );
  }
  const cap = Math.max(...rows.map((r) => r.maxHours), 1);
  const top = [...rows].sort((a, b) => b.plannedHours - a.plannedHours).slice(0, 6);
  return (
    <ul className={styles.bars}>
      {top.map((r) => {
        const pct = Math.min(100, Math.round((r.plannedHours / cap) * 100));
        return (
          <li key={r.userId} className={styles.barRow}>
            <span className={styles.barLabel}>
              <Avatar name={r.fullName} size="xs" />
              <span>{r.fullName}</span>
            </span>
            <span className={styles.barTrack}>
              <span
                className={`${styles.barFill} ${styles[`bar_${r.status}`]}`}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className={styles.barValue}>
              {r.plannedHours}/{r.maxHours}h
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBreakdown({
  todo,
  inProgress,
  done,
}: {
  todo: number;
  inProgress: number;
  done: number;
}) {
  const total = todo + inProgress + done;
  if (total === 0) {
    return (
      <p className={styles.muted}>
        No assignments yet. Run the optimizer or assign tasks manually.
      </p>
    );
  }
  const segments = [
    { key: 'TODO', value: todo, label: 'To do', tone: 'neutral' as const },
    { key: 'IN_PROGRESS', value: inProgress, label: 'In progress', tone: 'accent' as const },
    { key: 'DONE', value: done, label: 'Done', tone: 'success' as const },
  ];
  return (
    <div className={styles.statusBlock}>
      <div className={styles.statusBar}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.key}
              className={`${styles.statusSeg} ${styles[`status_${s.tone}`]}`}
              style={{ flex: s.value }}
              title={`${s.label}: ${s.value}`}
            />
          ))}
      </div>
      <ul className={styles.statusLegend}>
        {segments.map((s) => (
          <li key={s.key}>
            <span className={`${styles.statusDot} ${styles[`status_${s.tone}`]}`} aria-hidden />
            <span className={styles.statusLabel}>{s.label}</span>
            <span className={styles.statusValue}>{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className={styles.chartSkeleton}>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} width="100%" height={18} />
      ))}
    </div>
  );
}

function countStatuses(assignments: AssignmentWithRefsDto[]) {
  let todo = 0;
  let inProgress = 0;
  let done = 0;
  for (const a of assignments) {
    if (a.task.status === 'DONE') done += 1;
    else if (a.task.status === 'IN_PROGRESS') inProgress += 1;
    else todo += 1;
  }
  return { todo, inProgress, done };
}
