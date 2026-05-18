'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FolderKanban, Plus, Trash2 } from 'lucide-react';
import type { ProjectDto } from '@workforce/shared';
import { projectsApi } from '@/lib/api/projects';
import { useAuthStore } from '@/stores/auth-store';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { PageContainer } from '@/components/layout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  SectionHeader,
  Skeleton,
  Textarea,
} from '@/components/ui';
import styles from './page.module.scss';

export default function ProjectsListPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'ADMIN';

  const [projects, setProjects] = useState<ProjectDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', priority: '3' });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProjectDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleteBusy(true);
    try {
      await projectsApi.remove(confirmDelete.id);
      toastSuccess(`Project "${confirmDelete.name}" deleted`);
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      toastError(err, 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  }

  const description = projects
    ? `${projects.length} project${projects.length === 1 ? '' : 's'}`
    : loadError
      ? 'Could not load projects'
      : 'Loading…';

  return (
    <PageContainer
      title="Projects"
      description={description}
      actions={
        <Button
          variant={creating ? 'secondary' : 'primary'}
          leftIcon={<Plus size={14} />}
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? 'Cancel' : 'New project'}
        </Button>
      }
    >
      {loadError && <p className={styles.error}>{loadError}</p>}

      {creating && (
        <Card padding="lg">
          <SectionHeader as="h3" title="Create project" />
          <form className={styles.form} onSubmit={handleCreate}>
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Onboarding Revamp"
            />
            <Textarea
              label="Description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional context for the team"
            />
            <Input
              label="Priority"
              helper="1 (lowest) to 5 (highest)"
              type="number"
              min={1}
              max={5}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              inputSize="sm"
              className={styles.priorityInput}
            />
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => setCreating(false)} type="button">
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Create project
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding="none">
        {!projects && !loadError && (
          <div className={styles.skeletonStack}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <Skeleton width={200} height={16} />
                <Skeleton width={60} height={16} />
                <Skeleton width={40} height={16} />
              </div>
            ))}
          </div>
        )}

        {projects && projects.length === 0 && !creating && (
          <EmptyState
            icon={<FolderKanban size={20} />}
            title="No projects yet"
            description="Create your first project to start planning."
            action={
              <Button leftIcon={<Plus size={14} />} onClick={() => setCreating(true)}>
                New project
              </Button>
            }
          />
        )}

        {projects && projects.length > 0 && (
          <ul className={styles.list}>
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/manager/projects/${p.id}`} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span className={styles.projectName}>{p.name}</span>
                    {p.description && (
                      <span className={styles.projectDesc}>{p.description}</span>
                    )}
                  </span>
                  <span className={styles.rowMeta}>
                    <Badge variant={priorityVariant(p.priority)} size="sm">
                      P{p.priority}
                    </Badge>
                    <span className={styles.taskCount}>
                      {p.taskCount} task{p.taskCount === 1 ? '' : 's'}
                    </span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          setConfirmDelete(p);
                        }}
                        aria-label={`Delete ${p.name}`}
                        className={styles.dangerBtn}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                    <ArrowUpRight size={14} className={styles.arrow} aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete project"
        size="sm"
      >
        <Modal.Body>
          {confirmDelete && (
            <>
              <p>
                Delete <strong>{confirmDelete.name}</strong>?
              </p>
              <p className={styles.muted}>
                This removes the project and all its tasks. Assignments on those tasks are
                removed automatically.
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleteBusy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteBusy}>
            Delete project
          </Button>
        </Modal.Footer>
      </Modal>
    </PageContainer>
  );
}

function priorityVariant(p: number): 'neutral' | 'accent' | 'warning' | 'danger' {
  if (p >= 5) return 'danger';
  if (p === 4) return 'warning';
  if (p === 3) return 'accent';
  return 'neutral';
}
