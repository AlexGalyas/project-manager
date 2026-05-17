// Pure helpers for computing the current Mon–Fri week and bucketing
// assignment hours per (employee, day) by task deadline.

import type { AssignmentWithRefsDto, WorkloadStatus } from '@workforce/shared';

export interface WeekDay {
  date: Date;
  label: string; // "Mon"
  short: string; // "05/18"
  iso: string;
}

export function getCurrentWorkWeek(now: Date = new Date()): WeekDay[] {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offsetToMonday);
  d.setHours(0, 0, 0, 0);

  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return {
      date: day,
      label: names[i]!,
      short: `${String(day.getMonth() + 1).padStart(2, '0')}/${String(day.getDate()).padStart(2, '0')}`,
      iso: day.toISOString().slice(0, 10),
    };
  });
}

export function cellStatus(hours: number, dailyMax: number): WorkloadStatus {
  if (dailyMax <= 0) return 'normal';
  const ratio = hours / dailyMax;
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'normal';
  return 'under';
}

/**
 * Bucket each assignment's hours onto the column matching its task deadline,
 * if and only if that deadline falls within the given Mon-Fri week. Tasks
 * outside the week are returned in `outsideWeek` so the UI can mention them.
 *
 * Returns a map keyed by `${userId}|${iso}` -> hours.
 */
export function bucketAssignmentsByDay(
  assignments: AssignmentWithRefsDto[],
  week: WeekDay[],
): {
  cells: Map<string, number>;
  outsideWeekCount: number;
} {
  const cells = new Map<string, number>();
  const isoSet = new Set(week.map((d) => d.iso));
  let outsideWeekCount = 0;

  for (const a of assignments) {
    if (!a.task.deadline) {
      outsideWeekCount += 1;
      continue;
    }
    const iso = a.task.deadline.slice(0, 10);
    if (!isoSet.has(iso)) {
      outsideWeekCount += 1;
      continue;
    }
    const key = `${a.userId}|${iso}`;
    cells.set(key, (cells.get(key) ?? 0) + a.plannedHours);
  }
  return { cells, outsideWeekCount };
}
