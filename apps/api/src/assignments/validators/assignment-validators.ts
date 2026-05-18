import type { AssignmentWarningCode, AssignmentWarningDto } from '@workforce/shared';

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
