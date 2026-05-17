'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import type { ProjectDto } from '@workforce/shared';
import { projectsApi } from '@/lib/api/projects';
import { useAuthStore } from '@/stores/auth-store';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { EmptyState } from '@/components/EmptyState';
import { Spinner } from '@/components/Spinner';
import styles from './page.module.scss';

export default function ProjectsListPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'ADMIN';

  const [projects, setProjects] = useState<ProjectDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', priority: '3' });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setLoadError(null);
      setProjects(await projectsApi.list());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setLoadError(message);
      toastError(err, 'Failed to load projects');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await projectsApi.create({
        name: form.name,
        description: form.description || undefined,
        priority: Number.parseInt(form.priority, 10),
      });
      setForm({ name: '', description: '', priority: '3' });
      setCreating(false);
      toastSuccess('Project created');
      await refresh();
    } catch (err) {
      toastError(err, 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? This removes all its tasks too.`)) return;
    try {
      await projectsApi.remove(id);
      toastSuccess(`Project "${name}" deleted`);
      await refresh();
    } catch (err) {
      toastError(err, 'Delete failed');
    }
  }

  return (
    <section>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Projects</h1>
          <p className={styles.subtitle}>
            {projects
              ? `${projects.length} project${projects.length === 1 ? '' : 's'}`
              : loadError
                ? 'Could not load projects'
                : 'Loading…'}
          </p>
        </div>
        <button type="button" className={styles.newBtn} onClick={() => setCreating((v) => !v)}>
          <Plus size={16} />
          {creating ? 'Cancel' : 'New project'}
        </button>
      </div>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {creating && (
        <form className={styles.form} onSubmit={handleCreate}>
          <label className={styles.field}>
            <span>Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span>Description</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span>Priority (1–5)</span>
            <input
              type="number"
              min={1}
              max={5}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </label>
          <div className={styles.formActions}>
            <button type="submit" disabled={busy} className={styles.submit}>
              {busy ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      )}

      {!projects && !loadError && <Spinner />}

      {projects && projects.length === 0 && !creating && (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start planning."
        />
      )}

      {projects && projects.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Tasks</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/manager/projects/${p.id}`} className={styles.link}>
                      {p.name}
                    </Link>
                  </td>
                  <td className={styles.muted}>{p.description ?? '—'}</td>
                  <td>
                    <span className={`${styles.prio} ${styles[`prio_${p.priority}`]}`}>
                      P{p.priority}
                    </span>
                  </td>
                  <td>{p.taskCount}</td>
                  <td className={styles.actions}>
                    {isAdmin && (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(p.id, p.name)}
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
