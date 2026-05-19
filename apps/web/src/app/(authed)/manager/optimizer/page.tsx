'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  ListChecks,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type {
  AssignmentWithRefsDto,
  OptimizerResultDto,
  OptimizerUnassignedDto,
  OptimizerUnassignedReason,
  ProjectDto,
  UserSummaryDto,
} from '@workforce/shared';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import { assignmentsApi } from '@/lib/api/assignments';
import { optimizerApi } from '@/lib/api/optimizer';
import { toastError, toastSuccess } from '@/stores/ui-store';
import { PageContainer } from '@/components/layout';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Input,
  SectionHeader,
} from '@/components/ui';
import { StatCard } from '@/components/dashboard';
import styles from './page.module.scss';

const REASON_LABEL: Record<OptimizerUnassignedReason, string> = {
  NO_DAILY_CAPACITY: 'no daily capacity before deadline',
  MISSING_SKILLS: 'no eligible employee (skills)',
  DEPENDENCIES_UNSCHEDULED: 'waiting on dependencies',
  NO_DEADLINE_RANGE: 'deadline earlier than earliest start',
  CYCLIC_DEPENDENCIES: 'dependency cycle',
  OTHER: 'other',
};

const REASON_VARIANT: Record<
  OptimizerUnassignedReason,
  'warning' | 'danger' | 'info' | 'neutral'
> = {
  NO_DAILY_CAPACITY: 'danger',
  MISSING_SKILLS: 'warning',
  DEPENDENCIES_UNSCHEDULED: 'info',
  NO_DEADLINE_RANGE: 'danger',
  CYCLIC_DEPENDENCIES: 'danger',
  OTHER: 'neutral',
};

function groupUnassigned(
  list: OptimizerUnassignedDto[],
): Map<OptimizerUnassignedReason, OptimizerUnassignedDto[]> {
  const m = new Map<OptimizerUnassignedReason, OptimizerUnassignedDto[]>();
  for (const u of list) {
    const arr = m.get(u.reasonCode) ?? [];
    arr.push(u);
    m.set(u.reasonCode, arr);
  }
  return m;
}

export default function OptimizerPage() {
  const [projects, setProjects] = useState<ProjectDto[] | null>(null);
  const [users, setUsers] = useState<UserSummaryDto[] | null>(null);

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[] | 'all'>('all');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [includeWeekends, setIncludeWeekends] = useState(false);
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
        includeWeekends,
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
    <PageContainer
      title="Optimizer"
      description="Run the greedy strategy across one or more projects. Manual and locked assignments are always preserved."
    >
      <form className={styles.controls} onSubmit={handleRun}>
        <Card padding="lg">
          <SectionHeader
            as="h3"
            title="1. Choose projects"
            description="The optimizer only schedules unassigned TODO tasks in the selected scope."
          />
          <div className={styles.projectScope}>
            <Checkbox
              label="All projects"
              checked={selectedProjectIds === 'all'}
              onChange={() => setSelectedProjectIds('all')}
            />
            <Checkbox
              label="Selected projects only"
              checked={selectedProjectIds !== 'all'}
              onChange={() => setSelectedProjectIds([])}
            />
          </div>
          {selectedProjectIds !== 'all' && (
            <ul className={styles.projectList}>
              {projects?.map((p) => (
                <li key={p.id}>
                  <Checkbox
                    label={
                      <span className={styles.projectLabel}>
                        <span>{p.name}</span>
                        <span className={styles.projectMeta}>
                          {p.taskCount} task{p.taskCount === 1 ? '' : 's'} · P{p.priority}
                        </span>
                      </span>
                    }
                    checked={selectedProjectIds.includes(p.id)}
                    onChange={(e) => {
                      const set = new Set(selectedProjectIds as string[]);
                      if (e.target.checked) set.add(p.id);
                      else set.delete(p.id);
                      setSelectedProjectIds(Array.from(set));
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg">
          <SectionHeader as="h3" title="2. Choose mode" />
          <div className={styles.modeOptions}>
            <Checkbox
              label={
                <span className={styles.modeLabel}>
                  <strong>Schedule only unassigned tasks</strong>
                  <span className={styles.modeHint}>Existing assignments stay untouched.</span>
                </span>
              }
              checked={!replaceExisting}
              onChange={() => setReplaceExisting(false)}
            />
            <Checkbox
              label={
                <span className={styles.modeLabel}>
                  <strong>Re-optimize everything</strong>
                  <span className={styles.modeHint}>
                    Removes prior auto assignments only. Locked + manual are preserved.
                  </span>
                </span>
              }
              checked={replaceExisting}
              onChange={() => setReplaceExisting(true)}
            />
            <Checkbox
              label={
                <span className={styles.modeLabel}>
                  <strong>Include weekends</strong>
                  <span className={styles.modeHint}>
                    Schedule on Saturday + Sunday too. Off = Mon–Fri only.
                  </span>
                </span>
              }
              checked={includeWeekends}
              onChange={() => setIncludeWeekends((v) => !v)}
            />
          </div>
        </Card>

        <Card padding="lg">
          <SectionHeader
            as="h3"
            title="3. Tune the scoring weights"
            description={
              <>
                <code className={styles.formula}>
                  α·priority + β·(1 / max(1, daysUntilDeadline)) + γ·dependentsCount
                </code>
              </>
            }
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<RotateCcw size={12} />}
                onClick={resetWeights}
              >
                Reset
              </Button>
            }
          />
          <div className={styles.weightGrid}>
            <Input
              label="α priority"
              type="number"
              step={0.1}
              min={0}
              value={alpha}
              onChange={(e) => setAlpha(e.target.value)}
              inputSize="sm"
            />
            <Input
              label="β deadline"
              type="number"
              step={0.1}
              min={0}
              value={beta}
              onChange={(e) => setBeta(e.target.value)}
              inputSize="sm"
            />
            <Input
              label="γ dependents"
              type="number"
              step={0.1}
              min={0}
              value={gamma}
              onChange={(e) => setGamma(e.target.value)}
              inputSize="sm"
            />
          </div>
        </Card>

        <div className={styles.runRow}>
          <Button type="submit" loading={running} size="lg" leftIcon={<Play size={16} />}>
            {running ? 'Running…' : 'Run optimizer'}
          </Button>
          <span className={styles.existingNote}>
            {existingAssignments
              ? `${existingAssignments.length} assignment${existingAssignments.length === 1 ? '' : 's'} currently in DB`
              : 'Loading current assignments…'}
          </span>
        </div>
      </form>

      {result && (
        <>
          <div className={styles.metricsRow}>
            <StatCard
              label="New assignments"
              value={result.assignments.length}
              icon={<Sparkles size={16} />}
              tone="accent"
            />
            <StatCard
              label="Preserved"
              value={`${result.preservedCount}${
                result.lockedCount > 0 ? ` (${result.lockedCount} locked)` : ''
              }`}
              icon={<Lock size={16} />}
            />
            <StatCard
              label="Removed"
              value={result.removedCount}
              icon={<RotateCcw size={16} />}
              tone={result.removedCount > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Unassigned"
              value={result.unassigned.length}
              icon={<TriangleAlert size={16} />}
              tone={result.unassigned.length > 0 ? 'warning' : 'success'}
            />
            <StatCard
              label="Avg load"
              value={`${result.metrics.avgLoad}h`}
              icon={<Calculator size={16} />}
            />
            <StatCard
              label="Stddev load"
              value={result.metrics.stdDevLoad}
              icon={<Calculator size={16} />}
            />
            <StatCard
              label="Overloaded"
              value={result.metrics.overloadedCount}
              icon={<TriangleAlert size={16} />}
              tone={result.metrics.overloadedCount > 0 ? 'danger' : 'success'}
            />
            <StatCard
              label="Time"
              value={`${result.metrics.executionTimeMs}ms`}
              icon={<Sparkles size={16} />}
            />
          </div>

          {result.assignments.length === 0 && result.unassigned.length === 0 && (
            <Card padding="md" className={styles.calmNote}>
              <CheckCircle2 size={16} />
              <span>
                All in-scope tasks are already assigned. Nothing left for the optimizer to schedule.
              </span>
            </Card>
          )}

          {assignmentsByUser.length > 0 && (
            <Card padding="lg">
              <SectionHeader
                as="h3"
                title="Assignments by employee"
                description={`${result.assignments.length} new assignment${result.assignments.length === 1 ? '' : 's'} created`}
              />
              <div className={styles.assignGrid}>
                {assignmentsByUser.map((g) => (
                  <Card key={g.userId} padding="md" variant="default" className={styles.empGroup}>
                    <header className={styles.empHeader}>
                      <span className={styles.empIdentity}>
                        <Avatar name={g.user?.fullName ?? g.userId} size="sm" />
                        <span className={styles.empName}>
                          {g.user?.fullName ?? g.userId}
                        </span>
                      </span>
                      <Badge variant="accent" size="sm">
                        {g.totalHours}h
                        {g.user && ` / ${g.user.maxHoursPerWeek}h`}
                      </Badge>
                    </header>
                    <ul className={styles.empTaskList}>
                      {g.rows.map((r) => {
                        const ea = existingAssignments?.find((x) => x.taskId === r.taskId);
                        const projectName =
                          ea?.task.projectName ??
                          projectById.get(ea?.task.projectId ?? '')?.name ??
                          '—';
                        const taskName = ea?.task.name ?? r.taskId.slice(0, 8);
                        return (
                          <li key={r.taskId} className={styles.empTaskRow}>
                            <span className={styles.empTaskName}>{taskName}</span>
                            <span className={styles.empTaskMeta}>
                              {r.plannedHours}h · {projectName}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {result.unassigned.length > 0 && (
            <Card padding="lg">
              <SectionHeader
                as="h3"
                title="Unassigned tasks"
                description={`${result.unassigned.length} task${result.unassigned.length === 1 ? '' : 's'} couldn't be scheduled`}
              />
              {Array.from(groupUnassigned(result.unassigned).entries()).map(
                ([reasonCode, items]) => (
                  <div key={reasonCode} className={styles.unassignedGroup}>
                    <header className={styles.unassignedGroupHeader}>
                      <Badge
                        variant={REASON_VARIANT[reasonCode] ?? 'neutral'}
                        size="sm"
                      >
                        {REASON_LABEL[reasonCode] ?? reasonCode}
                      </Badge>
                      <span className={styles.unassignedGroupCount}>{items.length}</span>
                    </header>
                    <ul className={styles.unassignedList}>
                      {items.map((u) => (
                        <li key={u.taskId} className={styles.unassignedRow}>
                          <span className={styles.unassignedName}>
                            <ListChecks size={14} />
                            {u.taskName}
                          </span>
                          <span className={styles.unassignedReason}>{u.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </Card>
          )}
        </>
      )}

      {!result && !running && (
        <EmptyState
          icon={<Sparkles size={20} />}
          title="No run yet"
          description="Configure the options above and click Run optimizer to see results."
        />
      )}
    </PageContainer>
  );
}
