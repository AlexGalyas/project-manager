'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProjectDto } from '@workforce/shared';
import { FolderKanban, ListTodo } from 'lucide-react';
import { projectsApi } from '@/lib/api/projects';
import { toastError } from '@/stores/ui-store';
import styles from './page.module.scss';

export default function ManagerDashboard() {
  const [projects, setProjects] = useState<ProjectDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    projectsApi
      .list()
      .then(setProjects)
      .catch((err: Error) => {
        setLoadError(err.message);
        toastError(err, 'Failed to load projects');
      });
  }, []);

  const taskTotal = projects?.reduce((sum, p) => sum + p.taskCount, 0);

  return (
    <section>
      <h1 className={styles.heading}>Manager dashboard</h1>
      <p className={styles.subtitle}>
        Manage projects and their tasks. Run the optimizer to assign work.
      </p>

      {loadError && <p className={styles.error}>{loadError}</p>}

      <div className={styles.cards}>
        <article className={styles.card}>
          <div className={styles.cardIcon}>
            <FolderKanban size={18} />
          </div>
          <div>
            <span className={styles.cardLabel}>Projects</span>
            <strong className={styles.cardValue}>{projects?.length ?? '—'}</strong>
          </div>
        </article>
        <article className={styles.card}>
          <div className={styles.cardIcon}>
            <ListTodo size={18} />
          </div>
          <div>
            <span className={styles.cardLabel}>Tasks</span>
            <strong className={styles.cardValue}>{taskTotal ?? '—'}</strong>
          </div>
        </article>
      </div>

      <div className={styles.cta}>
        <Link href="/manager/projects" className={styles.ctaBtn}>
          Open projects →
        </Link>
      </div>
    </section>
  );
}
