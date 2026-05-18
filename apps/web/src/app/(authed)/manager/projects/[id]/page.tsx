'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ListTodo, Pencil, Plus, Trash2, X } from 'lucide-react';
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
import { PageContainer } from '@/components/layout';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionHeader,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { AssigneeCell } from '@/components/AssigneeCell';
import styles from './page.module.scss';

const STATUS_OPTIONS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

const STATUS_VARIANT: Record<TaskStatus, 'neutral' | 'accent' | 'success'> = {
  TODO: 'neutral',
  IN_PROGRESS: 'accent',
  DONE: 'success',
};

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
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<TaskDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
    setDeleteBusy(true);
    try {
      await projectsApi.remove(project.id);
      toastSuccess(`Project "${project.name}" deleted`);
      router.push('/manager/projects');
    } catch (err) {
      toastError(err, 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleDeleteTask() {
    if (!deleteTaskTarget) return;
    setDeleteBusy(true);
    try {
      await tasksApi.remove(deleteTaskTarget.id);
      toastSuccess(`Task "${deleteTaskTarget.name}" deleted`);
      setDeleteTaskTarget(null);
      await refresh();
    } catch (err) {
      toastError(err, 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loadError && !project) {
    return (
      <PageContainer>
        <Link href="/manager/projects" className={styles.back}>
          <ChevronLeft size={14} /> Back to projects
        </Link>
        <p className={styles.error}>{loadError}</p>
      </PageContainer>
    );
  }

  if (!project) {
    return (
      <PageContainer>
        <Link href="/manager/projects" className={styles.back}>
          <ChevronLeft size={14} /> Back to projects
        </Link>
        <Card padding="lg">
          <div className={styles.skeletonHeader}>
            <Skeleton width={260} height={28} />
            <Skeleton width={500} height={16} />
            <Skeleton width={180} height={14} />
          </div>
        </Card>
        <Card padding="none">
          <div className={styles.skeletonStack}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <Skeleton width="100%" height={16} />
              </div>
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <Link href="/manager/projects" className={styles.back}>
        <ChevronLeft size={14} /> Back to projects
      </Link>

      <Card padding="lg">
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
          <div className={styles.headerRow}>
            <div className={styles.headerText}>
              <h1 className={styles.heading}>{project.name}</h1>
              <p className={styles.subtitle}>
                {project.description ?? (
                  <span className={styles.muted}>(no description)</span>
                )}
              </p>
              <div className={styles.metaRow}>
                <Badge variant="accent" size="sm">
                  Priority {project.priority}
                </Badge>
                <span className={styles.muted}>·</span>
                <span className={styles.muted}>
                  {project.taskCount} task{project.taskCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <div className={styles.headerActions}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Pencil size={14} />}
                onClick={() => setEditingProject(true)}
              >
                Edit
              </Button>
              {isAdmin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 size={14} />}
                  onClick={() => setDeleteProjectOpen(true)}
                  className={styles.dangerBtn}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card padding="none">
        <div className={styles.tasksHeader}>
          <SectionHeader
            as="h2"
            title="Tasks"
            description="Click an assignee to change it, lock to keep the optimizer from moving them."
            action={
              <Button
                type="button"
                size="sm"
                variant={creatingTask ? 'secondary' : 'primary'}
                leftIcon={creatingTask ? <X size={14} /> : <Plus size={14} />}
                onClick={() => {
                  setCreatingTask((v) => !v);
                  setEditingTaskId(null);
                }}
              >
                {creatingTask ? 'Cancel' : 'New task'}
              </Button>
            }
          />
        </div>

        {creatingTask && (
          <div className={styles.formWrap}>
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
          </div>
        )}

        {project.tasks.length === 0 && !creatingTask ? (
          <EmptyState
            icon={<ListTodo size={20} />}
            title="No tasks in this project"
            description="Click 'New task' to add the first one."
          />
        ) : project.tasks.length > 0 ? (
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
                    <tr key={t.id} className={styles.editingRow}>
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
                      <td className={styles.hours}>{t.durationHours}h</td>
                      <td>
                        <Badge variant="neutral" size="sm">
                          P{t.priority}
                        </Badge>
                      </td>
                      <td>
                        <Badge variant={STATUS_VARIANT[t.status]} size="sm">
                          {t.status.toLowerCase().replace('_', ' ')}
                        </Badge>
                      </td>
                      <td>
                        {t.skills.length === 0 ? (
                          <span className={styles.muted}>—</span>
                        ) : (
                          <ul className={styles.skillChips}>
                            {t.skills.map((s) => (
                              <li key={s.skillId}>
                                <Badge variant="neutral" size="sm">
                                  {s.name}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className={styles.muted}>
                        {t.dependsOnIds.length || <span className={styles.muted}>—</span>}
                      </td>
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
                      <td>
                        <div className={styles.actions}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Edit task"
                            onClick={() => {
                              setEditingTaskId(t.id);
                              setCreatingTask(false);
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Delete task"
                            className={styles.dangerBtn}
                            onClick={() => setDeleteTaskTarget(t)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Modal
        open={deleteProjectOpen}
        onClose={() => setDeleteProjectOpen(false)}
        title="Delete project"
        size="sm"
      >
        <Modal.Body>
          <p>
            Delete <strong>{project.name}</strong>? This removes all{' '}
            <strong>{project.taskCount}</strong> task
            {project.taskCount === 1 ? '' : 's'} and their assignments too.
          </p>
          <p className={styles.muted}>This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setDeleteProjectOpen(false)}
            disabled={deleteBusy}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteProject} loading={deleteBusy}>
            Delete project
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={deleteTaskTarget !== null}
        onClose={() => setDeleteTaskTarget(null)}
        title="Delete task"
        size="sm"
      >
        <Modal.Body>
          {deleteTaskTarget && (
            <p>
              Delete <strong>{deleteTaskTarget.name}</strong>? This also removes its assignment if
              any.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setDeleteTaskTarget(null)}
            disabled={deleteBusy}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteTask} loading={deleteBusy}>
            Delete task
          </Button>
        </Modal.Footer>
      </Modal>
    </PageContainer>
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
    <form className={styles.editForm} onSubmit={submit}>
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Textarea
        label="Description"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        label="Priority (1–5)"
        type="number"
        min={1}
        max={5}
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className={styles.priorityInput}
      />
      <div className={styles.formActions}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save
        </Button>
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
    <form className={styles.editForm} onSubmit={submit}>
      <div className={styles.formGrid}>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Hours"
          type="number"
          step={0.5}
          min={0.5}
          value={durationHours}
          onChange={(e) => setDurationHours(e.target.value)}
          required
        />
        <Input
          label="Priority (1–5)"
          type="number"
          min={1}
          max={5}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
        <Input
          label="Deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <SkillsMultiSelect skills={skills} value={skillIds} onChange={setSkillIds} />
      <DepsMultiSelect tasks={existingTasks} value={dependsOnIds} onChange={setDependsOnIds} />
      <div className={styles.formActions}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Create task
        </Button>
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
    <form className={styles.editForm} onSubmit={submit}>
      <div className={styles.formGrid}>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Hours"
          type="number"
          step={0.5}
          min={0.5}
          value={durationHours}
          onChange={(e) => setDurationHours(e.target.value)}
        />
        <Input
          label="Priority (1–5)"
          type="number"
          min={1}
          max={5}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase().replace('_', ' ')}
            </option>
          ))}
        </Select>
        <Input
          label="Deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <SkillsMultiSelect skills={skills} value={skillIds} onChange={setSkillIds} />
      <DepsMultiSelect tasks={siblings} value={dependsOnIds} onChange={setDependsOnIds} />
      <div className={styles.formActions}>
        <Button type="button" variant="secondary" leftIcon={<X size={14} />} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save
        </Button>
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
    <Field label="Required skills">
      {skills.length === 0 ? (
        <span className={styles.muted}>(loading skills…)</span>
      ) : (
        <ul className={styles.checkList}>
          {skills.map((s) => (
            <li key={s.id}>
              <Checkbox
                checked={value.includes(s.id)}
                onChange={() => toggle(s.id)}
                label={s.name}
              />
            </li>
          ))}
        </ul>
      )}
    </Field>
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
    <Field label="Depends on">
      {tasks.length === 0 ? (
        <span className={styles.muted}>(no other tasks in this project yet)</span>
      ) : (
        <ul className={styles.checkList}>
          {tasks.map((t) => (
            <li key={t.id}>
              <Checkbox
                checked={value.includes(t.id)}
                onChange={() => toggle(t.id)}
                label={t.name}
              />
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
