'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CalendarClock,
  CheckCircle2,
  GitBranch,
  ListChecks,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
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

// Named presets so a manager doesn't have to reason about α/β/γ values directly.
interface WeightPreset {
  key: 'balanced' | 'deadlineRush' | 'priorityFirst' | 'unblockChains';
  label: string;
  description: string;
  alpha: number;
  beta: number;
  gamma: number;
}
const WEIGHT_PRESETS: WeightPreset[] = [
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'Reasonable defaults — slight lean on deadlines.',
    alpha: 1,
    beta: 2,
    gamma: 0.5,
  },
  {
    key: 'deadlineRush',
    label: 'Deadline rush',
    description: 'Pack the most-urgent tasks first; ignore priority almost entirely.',
    alpha: 0.5,
    beta: 4,
    gamma: 0.5,
  },
  {
    key: 'priorityFirst',
    label: 'Priority first',
    description: 'P5 tasks always go ahead, even if their deadline is comfortable.',
    alpha: 3,
    beta: 1,
    gamma: 0.5,
  },
  {
    key: 'unblockChains',
    label: 'Unblock chains',
    description: 'Schedule tasks that other tasks depend on before everything else.',
    alpha: 1,
    beta: 1,
    gamma: 2,
  },
];

/** A short sentence summarising what the current α/β/γ combo will prioritize. */
function describeStrategy(alpha: number, beta: number, gamma: number): string {
  const weights: { name: string; value: number }[] = [
    { name: 'task priority', value: alpha },
    { name: 'deadline urgency', value: beta },
    { name: 'unblocking dependents', value: gamma },
  ];
  const sorted = [...weights].sort((a, b) => b.value - a.value);
  const total = weights.reduce((s, w) => s + w.value, 0);
  if (total === 0) return 'All weights are zero — every task scores the same; order falls back to creation time.';
  const top = sorted[0]!;
  const second = sorted[1]!;
  // If top is much higher than second, it dominates. If close, blend.
  if (top.value === 0) return 'All weights are zero — every task scores the same.';
  if (second.value === 0 || top.value >= second.value * 2.5) {
    return `Strongly favors ${top.name}.`;
  }
  if (top.value >= second.value * 1.4) {
    return `Mostly ${top.name}, with some ${second.name}.`;
  }
  return `Balances ${top.name} and ${second.name}.`;
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
    applyPreset(WEIGHT_PRESETS[0]!);
  }

  function applyPreset(p: WeightPreset) {
    setAlpha(String(p.alpha));
    setBeta(String(p.beta));
    setGamma(String(p.gamma));
  }

  // Coerce the string-state weights into numbers once for the UI bits below.
  const alphaNum = Number.isFinite(Number.parseFloat(alpha)) ? Number.parseFloat(alpha) : 0;
  const betaNum = Number.isFinite(Number.parseFloat(beta)) ? Number.parseFloat(beta) : 0;
  const gammaNum = Number.isFinite(Number.parseFloat(gamma)) ? Number.parseFloat(gamma) : 0;

  // Match the current α/β/γ against a known preset (within 0.01 tolerance) so
  // we can highlight the active chip. Custom tweaks deselect everything.
  const activePresetKey =
    WEIGHT_PRESETS.find(
      (p) =>
        Math.abs(p.alpha - alphaNum) < 0.01 &&
        Math.abs(p.beta - betaNum) < 0.01 &&
        Math.abs(p.gamma - gammaNum) < 0.01,
    )?.key ?? null;

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
            title="3. Tune how tasks are ordered"
            description="The optimizer schedules tasks one by one. These three knobs decide which task it picks next."
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

          <div className={styles.presets} role="group" aria-label="Scoring presets">
            {WEIGHT_PRESETS.map((p) => {
              const active = activePresetKey === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  className={`${styles.presetChip} ${active ? styles.presetChipActive : ''}`}
                  onClick={() => applyPreset(p)}
                  title={p.description}
                  aria-pressed={active}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className={styles.sliderStack}>
            <WeightSlider
              icon={<TrendingUp size={14} />}
              label="Priority"
              greek="α"
              hint="Higher → P5 tasks go first, even if their deadline is comfortable."
              value={alphaNum}
              onChange={(v) => setAlpha(String(v))}
            />
            <WeightSlider
              icon={<CalendarClock size={14} />}
              label="Deadline urgency"
              greek="β"
              hint="Higher → tasks with the closest deadlines jump to the front."
              value={betaNum}
              onChange={(v) => setBeta(String(v))}
            />
            <WeightSlider
              icon={<GitBranch size={14} />}
              label="Unblock dependents"
              greek="γ"
              hint="Higher → tasks that other tasks depend on are scheduled first."
              value={gammaNum}
              onChange={(v) => setGamma(String(v))}
            />
          </div>

          <p className={styles.strategySummary}>
            <Calculator size={13} aria-hidden />
            <span>
              <strong>Current strategy:</strong>{' '}
              {describeStrategy(alphaNum, betaNum, gammaNum)}
            </span>
          </p>

          <details className={styles.formulaDetails}>
            <summary>Show the underlying formula</summary>
            <code className={styles.formula}>
              score(t) = α·priority(t) + β·(1 / max(1, daysUntilDeadline(t))) + γ·dependentsCount(t)
            </code>
            <p className={styles.formulaNote}>
              For each task the optimizer computes <code>score(t)</code>, sorts descending, and
              schedules in that order. Priority is the 1–5 number from the task. Deadline urgency
              grows as the deadline approaches (1/day). Dependents count is how many other tasks
              wait on this one.
            </p>
          </details>
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

/** A single scoring-weight slider with a Greek-letter tag, plain-English label,
 *  current value, and a one-liner hint about what raising it does. */
function WeightSlider({
  icon,
  label,
  greek,
  hint,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  greek: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  // Show the slider's track-fill percentage so the active region is visible
  // even before the user moves the thumb.
  const max = 5;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={styles.weightRow}>
      <div className={styles.weightHeader}>
        <span className={styles.weightLabel}>
          <span className={styles.weightIcon} aria-hidden>
            {icon}
          </span>
          <span>{label}</span>
          <span className={styles.weightGreek} aria-hidden>
            {greek}
          </span>
        </span>
        <span className={styles.weightValue}>{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        className={styles.weightRange}
        min={0}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        aria-label={`${label} weight (${greek})`}
      />
      <p className={styles.weightHint}>{hint}</p>
    </div>
  );
}
