import type { AssignmentWarningCode, AssignmentWarningDto, IsoDate } from '@workforce/shared';

export interface SkillCheckInput {
  user: { fullName: string; skillIds: string[] };
  task: { requiredSkillIds: string[]; requiredSkillNames: Map<string, string> };
}

export function checkSkills(input: SkillCheckInput): AssignmentWarningDto | null {
  const missingIds = input.task.requiredSkillIds.filter((id) => !input.user.skillIds.includes(id));
  if (missingIds.length === 0) return null;
  const missingNames = missingIds.map((id) => input.task.requiredSkillNames.get(id) ?? id);
  return warn('MISSING_SKILLS', {
    message: `${input.user.fullName} is missing required skills: ${missingNames.join(', ')}`,
    details: { skillIds: missingIds, skillNames: missingNames },
  });
}

export interface OverloadCheckInput {
  user: { fullName: string; maxHoursPerWeek: number; currentLoadHours: number };
  plannedHours: number;
}

export function checkOverload(input: OverloadCheckInput): AssignmentWarningDto | null {
  const projected = input.user.currentLoadHours + input.plannedHours;
  if (projected <= input.user.maxHoursPerWeek) return null;
  return warn('OVERLOAD', {
    message: `${input.user.fullName} would be loaded ${projected}h / ${input.user.maxHoursPerWeek}h max`,
    details: {
      currentLoadHours: input.user.currentLoadHours,
      plannedHours: input.plannedHours,
      maxHours: input.user.maxHoursPerWeek,
      projectedLoadHours: projected,
    },
  });
}

export interface DailyOverloadCheckInput {
  user: { fullName: string; maxHoursPerDay: number };
  /** Per-day load already booked (without the new assignment), keyed by YYYY-MM-DD. */
  existingDailyLoad: ReadonlyMap<IsoDate, number>;
  /** Per-day distribution this new (or updated) assignment is about to add. */
  addedDailyLoad: ReadonlyMap<IsoDate, number>;
}

/**
 * Returns at most one DAILY_OVERLOAD warning. The details payload lists every
 * date that goes over `maxHoursPerDay` so the manager can see the worst day(s)
 * at a glance.
 */
export function checkDailyOverload(input: DailyOverloadCheckInput): AssignmentWarningDto | null {
  const offenders: Array<{
    date: IsoDate;
    currentLoad: number;
    addedHours: number;
    maxHoursPerDay: number;
  }> = [];
  for (const [date, added] of input.addedDailyLoad) {
    const current = input.existingDailyLoad.get(date) ?? 0;
    if (current + added > input.user.maxHoursPerDay) {
      offenders.push({
        date,
        currentLoad: current,
        addedHours: added,
        maxHoursPerDay: input.user.maxHoursPerDay,
      });
    }
  }
  if (offenders.length === 0) return null;
  const worst = [...offenders].sort(
    (a, b) => b.currentLoad + b.addedHours - (a.currentLoad + a.addedHours),
  )[0]!;
  return warn('DAILY_OVERLOAD', {
    message:
      `${input.user.fullName} would be at ${worst.currentLoad + worst.addedHours}h on ${worst.date} ` +
      `(daily cap ${input.user.maxHoursPerDay}h)` +
      (offenders.length > 1 ? ` plus ${offenders.length - 1} more day(s)` : ''),
    details: { offenders },
  });
}

export interface DependencyCheckInput {
  task: {
    dependsOn: { id: string; name: string; status: 'TODO' | 'IN_PROGRESS' | 'DONE'; hasAssignment: boolean }[];
  };
}

/**
 * A dependency is "unresolved" if it is not DONE AND it currently has no
 * assignment. The brief defines unresolved as: status != DONE and not
 * currently assigned. Resolution: scheduling the dep makes it count.
 */
export function checkDependencies(input: DependencyCheckInput): AssignmentWarningDto | null {
  const unresolved = input.task.dependsOn.filter(
    (d) => d.status !== 'DONE' && !d.hasAssignment,
  );
  if (unresolved.length === 0) return null;
  const list = unresolved
    .map((d) => `${d.name} (${d.status.toLowerCase()})`)
    .join(', ');
  return warn('UNRESOLVED_DEPENDENCIES', {
    message: `Dependencies are not yet completed: ${list}`,
    details: {
      tasks: unresolved.map((d) => ({ id: d.id, name: d.name, status: d.status })),
    },
  });
}

function warn(
  code: AssignmentWarningCode,
  body: { message: string; details: unknown },
): AssignmentWarningDto {
  return { code, message: body.message, details: body.details };
}
