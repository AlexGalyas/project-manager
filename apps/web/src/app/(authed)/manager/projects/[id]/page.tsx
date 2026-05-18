'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Pencil, Plus, Trash2, X } from 'lucide-react';
import type {
  ProjectWithTasksDto,
  SkillDto,
  TaskDto,
  TaskStatus,
  UserSummaryDto,
  WorkloadEntryDto,
} from '@workforce/shared';
import { projectsApi } from '@/lib/api/projects';
import { tasksApi } from '@/lib/api/tasks';
import { skillsApi } from '@/lib/api/skills';
import { usersApi } from '@/lib/api/users';
import { workloadApi } from '@/lib/api/workload';
import { useAuthStore } from '@/stores/auth-store';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { EmptyState } from '@/components/EmptyState';
import { Spinner } from '@/components/Spinner';
import { AssigneeCell } from '@/components/AssigneeCell';
import styles from './page.module.scss';

const STATUS_OPTIONS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'ADMIN';

  const [project, setProject] = useState<ProjectWithTasksDto | null>(null);
  const [skills, setSkills] = useState<SkillDto[]>([]);
  const [employees, setEmployees] = useState<UserSummaryDto[]>([]);
  const [workload, setWorkload] = useState<WorkloadEntryDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoadError(null);
      const detail = await projectsApi.detail(projectId);
      setProject(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project';
      setLoadError(message);
      toastError(err, 'Failed to load project');
    }
  }, [projectId]);

  const refreshAssignmentContext = useCallback(async () => {
    try {
      const [users, wl] = await Promise.all([usersApi.list(), workloadApi.list()]);
      setEmployees(users.filter((u) => u.role === 'EMPLOYEE'));
      setWorkload(wl);
    } catch (err) {
      toastError(err, 'Failed to refresh assignment context');
    }
  }, []);

  useEffect(() => {
    refresh();
    skillsApi
      .list()
      .then(setSkills)
      .catch((err) => toastError(err, 'Failed to load skills'));
    refreshAssignmentContext();
  }, [refresh, refreshAssignmentContext]);

  async function handleDeleteProject() {
    if (!project) return;
    if (!confirm(`Delete project "${project.name}"? This removes all its tasks too.`)) return;
    try {
      await projectsApi.remove(project.id);
      toastSuccess(`Project "${project.name}" deleted`);
      router.push('/manager/projects');
    } catch (err) {
      toastError(err, 'Delete failed');
    }
  }

  async function handleDeleteTask(id: string, name: string) {
    if (!confirm(`Delete task "${name}"?`)) return;
    try {
      await tasksApi.remove(id);
      toastSuccess(`Task "${name}" deleted`);
      await refresh();
    } catch (err) {
      toastError(err, 'Delete failed');
    }
  }

  if (loadError && !project) {
    return (
      <section>
        <Link href="/manager/projects" className={styles.back}>
          <ChevronLeft size={14} /> Back
        </Link>
        <p className={styles.error}>{loadError}</p>
      </section>
    );
  }

  if (!project) {
    return <Spinner label="Loading project" />;
  }

  return (
    <section className={styles.page}>
      <Link href="/manager/projects" className={styles.back}>
        <ChevronLeft size={14} /> Back to projects
      </Link>

      {editingProject ? (
        <ProjectEditForm
          project={project}
          onCancel={() => setEditingProject(false)}
          onSaved={async () => {
            setEditingProject(false);
            toastSuccess('Project updated');
            await refresh();
          }}
        />
      ) : (
        <div className={styles.header}>
          <div>
            <h1 className={styles.heading}>{project.name}</h1>
            <p className={styles.subtitle}>
              {project.description ?? <span className={styles.muted}>(no description)</span>}
            </p>
            <p className={styles.metaRow}>
              <span className={`${styles.prio} ${styles[`prio_${project.priority}`]}`}>
                Priority {project.priority}
              </span>
              <span className={styles.muted}>· {project.taskCount} tasks</span>
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setEditingProject(true)}
              aria-label="Edit project"
            >
              <Pencil size={14} /> Edit
            </button>
            {isAdmin && (
              <button type="button" className={styles.deleteBtn} onClick={handleDeleteProject}>
                <Trash2 size={14} /> Delete project
              </button>
            )}
          </div>
        </div>
      )}

      <div className={styles.tasksHeader}>
        <h2 className={styles.subheading}>Tasks</h2>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => {
            setCreatingTask((v) => !v);
            setEditingTaskId(null);
          }}
        >
          <Plus size={14} /> {creatingTask ? 'Cancel' : 'New task'}
        </button>
      </div>

      {creatingTask && (
        <TaskCreateForm
          skills={skills}
          existingTasks={project.tasks}
          onCancel={() => setCreatingTask(false)}
          onCreated={async () => {
            setCreatingTask(false);
            toastSuccess('Task created');
            await refresh();
          }}
          projectId={project.id}
        />
      )}

      {project.tasks.length === 0 && !creatingTask && (
        <EmptyState
          title="No tasks in this project"
          description="Click 'New task' to add the first one."
        />
      )}

      {project.tasks.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Hours</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Skills</th>
                <th>Deps</th>
                <th>Deadline</th>
                <th>Assignee</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {project.tasks.map((t) =>
                editingTaskId === t.id ? (
                  <tr key={t.id}>
                    <td colSpan={9}>
                      <TaskEditForm
                        task={t}
                        skills={skills}
                        siblings={project.tasks.filter((other) => other.id !== t.id)}
                        onCancel={() => setEditingTaskId(null)}
                        onSaved={async () => {
                          setEditingTaskId(null);
                          toastSuccess('Task updated');
                          await refresh();
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td className={styles.taskName}>{t.name}</td>
                    <td>{t.durationHours}</td>
                    <td>
                      <span className={`${styles.prio} ${styles[`prio_${t.priority}`]}`}>
                        P{t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.status} ${styles[`status_${t.status}`]}`}>
                        {t.status.toLowerCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {t.skills.length === 0 ? (
                        <span className={styles.muted}>—</span>
                      ) : (
                        <ul className={styles.skillsList}>
                          {t.skills.map((s) => (
                            <li key={s.skillId}>{s.name}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>{t.dependsOnIds.length || <span className={styles.muted}>—</span>}</td>
                    <td className={styles.muted}>
                      {t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <AssigneeCell
                        task={t}
                        employees={employees}
                        workload={workload}
                        onChanged={async () => {
                          await refresh();
                          await refreshAssignmentContext();
                        }}
                      />
                    </td>
                    <td className={styles.actions}>
                      <button
                        type="button"
                        className={styles.iconBtnSmall}
                        onClick={() => {
                          setEditingTaskId(t.id);
                          setCreatingTask(false);
                        }}
                        aria-label="Edit task"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtnSmall}
                        onClick={() => handleDeleteTask(t.id, t.name)}
                        aria-label="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProjectEditForm({
  project,
  onCancel,
  onSaved,
}: {
  project: ProjectWithTasksDto;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [priority, setPriority] = useState(String(project.priority));
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await projectsApi.update(project.id, {
        name,
        description: description || undefined,
        priority: Number.parseInt(priority, 10),
      });
      await onSaved();
    } catch (err) {
      toastError(err, 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.editCard} onSubmit={submit}>
      <label className={styles.field}>
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span>Description</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Priority (1–5)</span>
        <input
          type="number"
          min={1}
          max={5}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
      </label>
      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function TaskCreateForm({
  projectId,
  skills,
  existingTasks,
  onCancel,
  onCreated,
}: {
  projectId: string;
  skills: SkillDto[];
  existingTasks: TaskDto[];
  onCancel: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [durationHours, setDurationHours] = useState('8');
  const [priority, setPriority] = useState('3');
  const [deadline, setDeadline] = useState('');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [dependsOnIds, setDependsOnIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await projectsApi.createTask(projectId, {
        name,
        durationHours: Number.parseFloat(durationHours),
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        priority: Number.parseInt(priority, 10),
        status: 'TODO',
        skillIds,
        dependsOnIds,
      });
      await onCreated();
    } catch (err) {
      toastError(err, 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.editCard} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>Hours</span>
          <input
            type="number"
            step={0.5}
            min={0.5}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          <span>Priority (1–5)</span>
          <input
            type="number"
            min={1}
            max={5}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Deadline</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>
      <SkillsMultiSelect skills={skills} value={skillIds} onChange={setSkillIds} />
      <DepsMultiSelect tasks={existingTasks} value={dependsOnIds} onChange={setDependsOnIds} />
      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn} disabled={busy}>
          {busy ? 'Creating…' : 'Create task'}
        </button>
      </div>
    </form>
  );
}

function TaskEditForm({
  task,
  skills,
  siblings,
  onCancel,
  onSaved,
}: {
  task: TaskDto;
  skills: SkillDto[];
  siblings: TaskDto[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(task.name);
  const [durationHours, setDurationHours] = useState(String(task.durationHours));
  const [priority, setPriority] = useState(String(task.priority));
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [deadline, setDeadline] = useState(task.deadline ? task.deadline.slice(0, 10) : '');
  const [skillIds, setSkillIds] = useState<string[]>(task.skills.map((s) => s.skillId));
  const [dependsOnIds, setDependsOnIds] = useState<string[]>(task.dependsOnIds);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await tasksApi.update(task.id, {
        name,
        durationHours: Number.parseFloat(durationHours),
        deadline: deadline ? new Date(deadline).toISOString() : null,
        priority: Number.parseInt(priority, 10),
        status,
        skillIds,
        dependsOnIds,
      });
      await onSaved();
    } catch (err) {
      toastError(err, 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.editCard} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>Hours</span>
          <input
            type="number"
            step={0.5}
            min={0.5}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Priority (1–5)</span>
          <input
            type="number"
            min={1}
            max={5}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Deadline</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>
      <SkillsMultiSelect skills={skills} value={skillIds} onChange={setSkillIds} />
      <DepsMultiSelect tasks={siblings} value={dependsOnIds} onChange={setDependsOnIds} />
      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
        <button type="submit" className={styles.submitBtn} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function SkillsMultiSelect({
  skills,
  value,
  onChange,
}: {
  skills: SkillDto[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }
  return (
    <fieldset className={styles.checkGroup}>
      <legend>Required skills</legend>
      {skills.length === 0 ? (
        <span className={styles.muted}>(loading skills…)</span>
      ) : (
        <ul className={styles.checkList}>
          {skills.map((s) => (
            <li key={s.id}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={value.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />
                {s.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function DepsMultiSelect({
  tasks,
  value,
  onChange,
}: {
  tasks: TaskDto[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }
  return (
    <fieldset className={styles.checkGroup}>
      <legend>Depends on</legend>
      {tasks.length === 0 ? (
        <span className={styles.muted}>(no other tasks in this project yet)</span>
      ) : (
        <ul className={styles.checkList}>
          {tasks.map((t) => (
            <li key={t.id}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={value.includes(t.id)}
                  onChange={() => toggle(t.id)}
                />
                {t.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
