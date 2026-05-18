'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Play, RotateCcw, Sparkles } from 'lucide-react';
import type {
  AssignmentWithRefsDto,
  OptimizerResultDto,
  ProjectDto,
  UserSummaryDto,
} from '@workforce/shared';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import { assignmentsApi } from '@/lib/api/assignments';
import { optimizerApi } from '@/lib/api/optimizer';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { EmptyState } from '@/components/EmptyState';
import { Spinner } from '@/components/Spinner';
import styles from './page.module.scss';

export default function OptimizerPage() {
  const [projects, setProjects] = useState<ProjectDto[] | null>(null);
  const [users, setUsers] = useState<UserSummaryDto[] | null>(null);

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[] | 'all'>('all');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [alpha, setAlpha] = useState('1');
  const [beta, setBeta] = useState('2');
  const [gamma, setGamma] = useState('0.5');

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OptimizerResultDto | null>(null);
  const [existingAssignments, setExistingAssignments] =
    useState<AssignmentWithRefsDto[] | null>(null);

  const userById = useMemo(() => {
    const map = new Map<string, UserSummaryDto>();
    users?.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const projectById = useMemo(() => {
    const map = new Map<string, ProjectDto>();
    projects?.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  async function refreshLookups() {
    try {
      const [p, u, a] = await Promise.all([
        projectsApi.list(),
        usersApi.list(),
        assignmentsApi.list(),
      ]);
      setProjects(p);
      setUsers(u);
      setExistingAssignments(a);
    } catch (err) {
      toastError(err, 'Failed to load optimizer data');
    }
  }

  useEffect(() => {
    refreshLookups();
  }, []);

  async function handleRun(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRunning(true);
    setResult(null);
    try {
      const payload = {
        replaceExisting,
        projectIds:
          selectedProjectIds === 'all' || selectedProjectIds.length === 0
            ? undefined
            : selectedProjectIds,
        weights: {
          alpha: Number.parseFloat(alpha),
          beta: Number.parseFloat(beta),
          gamma: Number.parseFloat(gamma),
        },
      };
      const r = await optimizerApi.run(payload);
      setResult(r);
      if (r.assignments.length === 0 && r.unassigned.length === 0) {
        toastSuccess('All tasks are already assigned. Nothing to optimize.');
      } else {
        toastSuccess(
          `Run done: +${r.assignments.length} new, ${r.preservedCount} preserved (${r.lockedCount} locked), ${r.unassigned.length} unassigned`,
        );
      }
      // Refresh existing assignments to reflect persisted data.
      const a = await assignmentsApi.list();
      setExistingAssignments(a);
    } catch (err) {
      toastError(err, 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  function resetWeights() {
    setAlpha('1');
    setBeta('2');
    setGamma('0.5');
  }

  const assignmentsByUser = useMemo(() => {
    if (!result) return [];
    const groups = new Map<string, { user: UserSummaryDto | null; rows: typeof result.assignments }>();
    for (const a of result.assignments) {
      const u = userById.get(a.userId) ?? null;
      if (!groups.has(a.userId)) {
        groups.set(a.userId, { user: u, rows: [] });
      }
      groups.get(a.userId)!.rows.push(a);
    }
    return Array.from(groups.entries())
      .map(([userId, { user, rows }]) => ({
        userId,
        user,
        rows,
        totalHours: rows.reduce((s, r) => s + r.plannedHours, 0),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [result, userById]);

  return (
    <section className={styles.page}>
      <header>
        <h1 className={styles.heading}>
          <Sparkles size={20} /> Optimizer
        </h1>
        <p className={styles.subtitle}>
          Run the greedy assignment strategy across one or more projects. Manual and locked
          assignments are always preserved.
        </p>
      </header>

      <form className={styles.controls} onSubmit={handleRun}>
        <fieldset className={styles.fieldset}>
          <legend>Projects to include</legend>
          <div className={styles.projectChoice}>
            <label className={styles.radio}>
              <input
                type="radio"
                checked={selectedProjectIds === 'all'}
                onChange={() => setSelectedProjectIds('all')}
              />
              All projects
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                checked={selectedProjectIds !== 'all'}
                onChange={() => setSelectedProjectIds([])}
              />
              Selected projects
            </label>
          </div>
          {selectedProjectIds !== 'all' && (
            <ul className={styles.projectList}>
              {projects?.map((p) => (
                <li key={p.id}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.includes(p.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProjectIds([...(selectedProjectIds as string[]), p.id]);
                        } else {
                          setSelectedProjectIds((selectedProjectIds as string[]).filter((x) => x !== p.id));
                        }
                      }}
                    />
                    {p.name} <span className={styles.muted}>({p.taskCount} tasks · P{p.priority})</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Mode</legend>
          <label className={styles.radio}>
            <input
              type="radio"
              checked={!replaceExisting}
              onChange={() => setReplaceExisting(false)}
            />
            <span>
              <strong>Schedule only unassigned tasks</strong>
              <em className={styles.radioHint}>
                Existing assignments are left untouched.
              </em>
            </span>
          </label>
          <label className={styles.radio}>
            <input
              type="radio"
              checked={replaceExisting}
              onChange={() => setReplaceExisting(true)}
            />
            <span>
              <strong>Re-optimize everything</strong>
              <em className={styles.radioHint}>
                Removes prior auto assignments only. Locked + manual assignments are preserved.
              </em>
            </span>
          </label>

          <div className={styles.weights}>
            <div className={styles.weightsHeader}>
              <span>
                Weights for the composite score:
                <code className={styles.formula}>
                  α·priority + β·(1 / max(1, daysUntilDeadline)) + γ·dependentsCount
                </code>
              </span>
              <button type="button" className={styles.linkBtn} onClick={resetWeights}>
                <RotateCcw size={12} /> Reset to defaults
              </button>
            </div>
            <div className={styles.weightInputs}>
              <label className={styles.weight}>
                <span>α (priority)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={alpha}
                  onChange={(e) => setAlpha(e.target.value)}
                />
              </label>
              <label className={styles.weight}>
                <span>β (deadline)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={beta}
                  onChange={(e) => setBeta(e.target.value)}
                />
              </label>
              <label className={styles.weight}>
                <span>γ (dependents)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={gamma}
                  onChange={(e) => setGamma(e.target.value)}
                />
              </label>
            </div>
          </div>
        </fieldset>

        <div className={styles.actions}>
          <button type="submit" className={styles.runBtn} disabled={running}>
            {running ? <Spinner size={14} inline label="Running" /> : <Play size={16} />}
            {running ? 'Running…' : 'Run optimizer'}
          </button>
          <span className={styles.existingNote}>
            {existingAssignments
              ? `${existingAssignments.length} assignment${existingAssignments.length === 1 ? '' : 's'} currently in DB`
              : 'Loading current assignments…'}
          </span>
        </div>
      </form>

      {result && (
        <>
          <section className={styles.summary}>
            <Metric label="Strategy" value={result.strategy} />
            <Metric label="New assignments" value={result.assignments.length} />
            <Metric
              label="Preserved"
              value={`${result.preservedCount}${result.lockedCount > 0 ? ` (${result.lockedCount} locked)` : ''}`}
            />
            <Metric label="Removed" value={result.removedCount} />
            <Metric label="Unassigned" value={result.unassigned.length} />
            <Metric label="Avg load (h)" value={result.metrics.avgLoad} />
            <Metric label="Stddev load" value={result.metrics.stdDevLoad} />
            <Metric label="Overloaded" value={result.metrics.overloadedCount} />
            <Metric label="Time (ms)" value={result.metrics.executionTimeMs} />
          </section>

          {result.assignments.length === 0 && result.unassigned.length === 0 && (
            <p className={styles.calmNote}>
              All in-scope tasks are already assigned. Nothing left for the optimizer to schedule.
            </p>
          )}

          <section>
            <h2 className={styles.subheading}>Assignments by employee</h2>
            {assignmentsByUser.length === 0 ? (
              <EmptyState title="No assignments produced" />
            ) : (
              <div className={styles.assignTable}>
                {assignmentsByUser.map((g) => (
                  <article key={g.userId} className={styles.assignGroup}>
                    <header>
                      <strong>{g.user?.fullName ?? g.userId}</strong>
                      <span className={styles.muted}>
                        {g.rows.length} task{g.rows.length === 1 ? '' : 's'} · {g.totalHours}h
                        {g.user && ` / ${g.user.maxHoursPerWeek}h cap`}
                      </span>
                    </header>
                    <ul>
                      {g.rows.map((r) => {
                        // Find the originating project for this taskId via assignments lookup.
                        const ea = existingAssignments?.find((x) => x.taskId === r.taskId);
                        const projectName =
                          ea?.task.projectName ??
                          projectById.get(ea?.task.projectId ?? '')?.name ??
                          '—';
                        const taskName = ea?.task.name ?? r.taskId.slice(0, 8);
                        return (
                          <li key={r.taskId}>
                            <span>{taskName}</span>
                            <span className={styles.muted}>
                              {r.plannedHours}h · {projectName}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>

          {result.unassigned.length > 0 && (
            <section>
              <h2 className={styles.subheading}>Unassigned tasks</h2>
              <ul className={styles.unassignedList}>
                {result.unassigned.map((u) => (
                  <li key={u.taskId}>
                    <strong>{u.taskName}</strong>
                    <span className={styles.muted}>· {u.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
    </div>
  );
}
