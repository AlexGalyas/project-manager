'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Brain,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  Sparkles,
  Users,
} from 'lucide-react';
import type { ProjectDto, SkillDto, UserSummaryDto } from '@workforce/shared';
import { usersApi } from '@/lib/api/users';
import { projectsApi } from '@/lib/api/projects';
import { skillsApi } from '@/lib/api/skills';
import { workloadApi } from '@/lib/api/workload';
import { toastError } from '@/stores/ui-store';
import { PageContainer } from '@/components/layout';
import { Badge, Card, SectionHeader } from '@/components/ui';
import { StatCard } from '@/components/dashboard';
import styles from './page.module.scss';

interface DashboardData {
  users: UserSummaryDto[];
  projects: ProjectDto[];
  skills: SkillDto[];
  avgLoad: number;
  overloaded: number;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      usersApi.list(),
      projectsApi.list(),
      skillsApi.list(),
      workloadApi.list(),
    ])
      .then(([users, projects, skills, workload]) => {
        const employees = workload;
        const avg =
          employees.length > 0
            ? employees.reduce((s, w) => s + w.plannedHours, 0) / employees.length
            : 0;
        const overloaded = employees.filter((w) => w.status === 'over').length;
        setData({
          users,
          projects,
          skills,
          avgLoad: Math.round(avg * 10) / 10,
          overloaded,
        });
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load dashboard');
      });
  }, []);

  const taskCount = data?.projects.reduce((s, p) => s + p.taskCount, 0) ?? null;
  const roleCounts = {
    admin: data?.users.filter((u) => u.role === 'ADMIN').length ?? 0,
    manager: data?.users.filter((u) => u.role === 'MANAGER').length ?? 0,
    employee: data?.users.filter((u) => u.role === 'EMPLOYEE').length ?? 0,
  };

  return (
    <PageContainer
      title="Admin overview"
      description="Organization-wide snapshot. Manage users, skills, and run the optimizer from here."
    >
      {loadError && <p className={styles.error}>{loadError}</p>}

      <div className={styles.statsRow}>
        <StatCard
          label="Total users"
          value={data?.users.length ?? null}
          icon={<Users size={16} />}
          description={
            data
              ? `${roleCounts.admin} admin · ${roleCounts.manager} manager · ${roleCounts.employee} employee`
              : 'Loading…'
          }
        />
        <StatCard
          label="Total projects"
          value={data?.projects.length ?? null}
          icon={<FolderKanban size={16} />}
          description={data ? `${taskCount} tasks across all projects` : undefined}
        />
        <StatCard
          label="Tasks"
          value={taskCount}
          icon={<ListTodo size={16} />}
          tone="accent"
        />
        <StatCard
          label="Avg workload"
          value={data ? `${data.avgLoad}h` : null}
          icon={<Sparkles size={16} />}
          description={
            data && data.overloaded > 0
              ? `${data.overloaded} overloaded`
              : data
                ? 'All within capacity'
                : undefined
          }
          tone={data && data.overloaded > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className={styles.twoCol}>
        <Card className={styles.col} padding="lg">
          <SectionHeader
            as="h3"
            title="Recent activity"
            description="A snapshot of what's happening in the org."
          />
          <ul className={styles.activity}>
            {activityFeed(data).map((a, i) => (
              <li key={i} className={styles.activityItem}>
                <span className={styles.activityIcon}>{a.icon}</span>
                <span className={styles.activityText}>
                  <span>{a.text}</span>
                  <span className={styles.activityMeta}>{a.meta}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className={styles.col} padding="lg">
          <SectionHeader as="h3" title="Quick actions" />
          <div className={styles.links}>
            <QuickLink
              href="/admin/users"
              icon={<Users size={16} />}
              title="Manage users"
              description="Create, edit, assign skills, change passwords."
              badge={data ? data.users.length : null}
            />
            <QuickLink
              href="/admin/skills"
              icon={<Brain size={16} />}
              title="Manage skills"
              description="The organization-wide skill catalog."
              badge={data ? data.skills.length : null}
            />
            <QuickLink
              href="/manager/projects"
              icon={<FolderKanban size={16} />}
              title="Browse projects"
              description="See every project + its tasks."
              badge={data ? data.projects.length : null}
            />
            <QuickLink
              href="/manager/optimizer"
              icon={<Sparkles size={16} />}
              title="Run the optimizer"
              description="Distribute unassigned tasks across employees."
            />
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: number | null;
}) {
  return (
    <Link href={href} className={styles.link}>
      <span className={styles.linkIcon}>{icon}</span>
      <span className={styles.linkText}>
        <span className={styles.linkTitle}>
          {title}
          {badge != null && (
            <Badge variant="neutral" size="sm">
              {badge}
            </Badge>
          )}
        </span>
        <span className={styles.linkDesc}>{description}</span>
      </span>
      <ArrowUpRight size={14} className={styles.linkArrow} aria-hidden />
    </Link>
  );
}

interface ActivityRow {
  icon: React.ReactNode;
  text: string;
  meta: string;
}

function activityFeed(data: DashboardData | null): ActivityRow[] {
  if (!data) {
    return [
      {
        icon: <Sparkles size={14} />,
        text: 'Optimizer is ready to run',
        meta: 'Loading…',
      },
    ];
  }
  return [
    {
      icon: <Users size={14} />,
      text: `${data.users.length} users in the organization`,
      meta: 'Seeded data',
    },
    {
      icon: <FolderKanban size={14} />,
      text: `${data.projects.length} active projects`,
      meta: 'From seed',
    },
    {
      icon: <Brain size={14} />,
      text: `${data.skills.length} skills in the catalog`,
      meta: '/admin/skills',
    },
    {
      icon: <CheckCircle2 size={14} />,
      text:
        (data.overloaded ?? 0) > 0
          ? `${data.overloaded} employees overloaded this week`
          : 'All employees within their weekly cap',
      meta: 'Workload',
    },
  ];
}
