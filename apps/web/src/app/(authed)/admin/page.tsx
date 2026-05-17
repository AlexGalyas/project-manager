'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, FolderKanban, Brain } from 'lucide-react';
import { usersApi } from '@/lib/api/users';
import { projectsApi } from '@/lib/api/projects';
import { skillsApi } from '@/lib/api/skills';
import { toastError } from '@/stores/ui-store';
import styles from './page.module.scss';

interface Counts {
  users: number;
  projects: number;
  skills: number;
  tasks: number;
}

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([usersApi.list(), projectsApi.list(), skillsApi.list()])
      .then(([users, projects, skills]) => {
        const tasks = projects.reduce((sum, p) => sum + p.taskCount, 0);
        setCounts({ users: users.length, projects: projects.length, skills: skills.length, tasks });
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load dashboard');
      });
  }, []);

  return (
    <section>
      <h1 className={styles.heading}>Admin dashboard</h1>
      <p className={styles.subtitle}>
        Read-only overview of the organization. Use the nav to drill into users, projects, or run
        the optimizer.
      </p>

      {loadError && <p className={styles.error}>{loadError}</p>}

      <div className={styles.cards}>
        <Stat icon={<Users size={18} />} label="Users" value={counts?.users} href="/admin/users" />
        <Stat
          icon={<FolderKanban size={18} />}
          label="Projects"
          value={counts?.projects}
          href="/manager/projects"
        />
        <Stat icon={<FolderKanban size={18} />} label="Tasks" value={counts?.tasks} />
        <Stat icon={<Brain size={18} />} label="Skills" value={counts?.skills} />
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  href?: string;
}) {
  const inner = (
    <article className={styles.card}>
      <div className={styles.cardIcon}>{icon}</div>
      <div className={styles.cardBody}>
        <span className={styles.cardLabel}>{label}</span>
        <strong className={styles.cardValue}>{value ?? '—'}</strong>
      </div>
    </article>
  );
  return href ? (
    <Link href={href} className={styles.cardLink}>
      {inner}
    </Link>
  ) : (
    inner
  );
}
