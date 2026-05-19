// Pure helpers for computing the current Mon-Fri week and bucketing
// assignment hours per (employee, day).
//
// The optimizer places work day-by-day, respecting per-day capacity AND
// the running load contributed by previously placed assignments for the
// same employee. When we reconstruct the heatmap we have to mirror that:
// assignments must be processed per user IN ORDER, each one front-filled
// against the user's accumulated dailyLoad map, otherwise a 14h task that
// followed a 14h task on overlapping dates would double-count.
//
// Pre-Phase 9 this file bucketed by task deadline, which produced wildly
// off readings — a 14h task with deadline Wednesday showed as 14h on Wed
// even though the actual schedule spread it across two days. We now
// honour what the optimizer (or manual auto-distribute) placed.

import {
  distributeAssignmentByDay,
  type AssignmentWithRefsDto,
  type IsoDate,
  type WorkloadStatus,
} from '@workforce/shared';

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
 * Reconstruct each employee's per-day load by replaying their assignments in
 * (plannedStart, createdAt) order — the same order the optimizer would have
 * placed them — front-filling each one against the running dailyLoad map
 * with a per-day cap of `maxHoursPerDay`. This mirrors the optimizer's
 * placement so the heatmap matches what is actually scheduled.
 *
 * - Assignments lacking plannedStart / plannedEnd (legacy rows that haven't
 *   been re-optimized yet) are counted as `unscheduledCount` so the UI can
 *   flag "needs scheduling".
 * - Hours that fall outside the visible Mon-Fri week count toward
 *   `outsideWeekCount`.
 */
export function bucketAssignmentsByDay(
  assignments: AssignmentWithRefsDto[],
  week: WeekDay[],
  dailyMaxByUser: ReadonlyMap<string, number>,
): {
  cells: Map<string, number>;
  outsideWeekCount: number;
  unscheduledCount: number;
} {
  const cells = new Map<string, number>();
  const isoSet = new Set(week.map((d) => d.iso));
  let outsideWeekCount = 0;
  let unscheduledCount = 0;

  // Visible-week bounds for the outside-week count.
  const weekStartIso = week[0]?.iso ?? '';
  const weekEndIso = week[week.length - 1]?.iso ?? '';

  // Group assignments by userId.
  const byUser = new Map<string, AssignmentWithRefsDto[]>();
  for (const a of assignments) {
    if (!a.plannedStart || !a.plannedEnd) {
      unscheduledCount += 1;
      continue;
    }
    const startIso = a.plannedStart.slice(0, 10);
    const endIso = a.plannedEnd.slice(0, 10);
    if (startIso < weekStartIso || endIso > weekEndIso) {
      outsideWeekCount += 1;
    }
    const arr = byUser.get(a.userId) ?? [];
    arr.push(a);
    byUser.set(a.userId, arr);
  }

  for (const [userId, list] of byUser) {
    const dailyMax = dailyMaxByUser.get(userId) ?? 8;
    // Sort by plannedStart asc, then by createdAt asc — stable + matches
    // the optimizer's placement order well enough for the reconstruction.
    list.sort((a, b) => {
      const pa = a.plannedStart ?? '';
      const pb = b.plannedStart ?? '';
      if (pa !== pb) return pa.localeCompare(pb);
      return a.createdAt.localeCompare(b.createdAt);
    });

    const userDaily = new Map<IsoDate, number>();
    for (const a of list) {
      const dist = distributeAssignmentByDay({
        plannedStart: a.plannedStart!.slice(0, 10),
        plannedEnd: a.plannedEnd!.slice(0, 10),
        plannedHours: a.plannedHours,
        maxHoursPerDay: dailyMax,
        includeWeekends: false,
      });
      // Re-fit against the user's running dailyLoad so we don't double-book
      // a day. Carry overflow forward into the next working day inside the
      // assignment's range.
      let remaining = 0;
      for (const [iso, h] of dist) {
        const used = userDaily.get(iso) ?? 0;
        const avail = Math.max(0, dailyMax - used);
        if (avail <= 0) {
          remaining += h;
          continue;
        }
        const take = Math.min(h + remaining, avail);
        userDaily.set(iso, used + take);
        remaining = h + remaining - take;
      }
      // Anything still remaining doesn't fit in the assignment's stored range
      // (e.g. because earlier assignments swallowed the entire window). That
      // simply doesn't show up in the heatmap — the user will notice the
      // mismatch and the manager can re-run the optimizer.
    }

    for (const [iso, hours] of userDaily) {
      if (isoSet.has(iso)) {
        cells.set(`${userId}|${iso}`, hours);
      }
    }
  }

  return { cells, outsideWeekCount, unscheduledCount };
}
