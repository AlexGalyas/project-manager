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

import type {
  AssignmentWithRefsDto,
  IsoDate,
  WorkloadStatus,
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
 * Reconstruct each employee's per-day load to match what the optimizer
 * actually placed.
 *
 * The DB only stores per-assignment `plannedStart`, `plannedEnd`, and
 * `plannedHours` — the exact per-day distribution isn't persisted. To
 * recover it we replay the placement: walk a user's assignments in
 * (plannedStart, createdAt) order and, for each one, front-fill its
 * `plannedHours` into the user's running daily-load map starting from
 * `plannedStart`. We respect `maxHoursPerDay` per day and SPILL into
 * subsequent working days if the assignment's stored end is too tight
 * (which happens when a later assignment overlapped its range — earlier
 * placements steal capacity, the later one has to push out).
 *
 * `plannedEnd` is therefore only a *display hint*, not a hard stop. Using
 * it as a strict boundary (the previous implementation did) under-reported
 * hours whenever assignments overlapped: a 4h task on a day already full
 * from an earlier task would simply vanish from the heatmap.
 *
 * - Assignments lacking plannedStart / plannedEnd (legacy rows) are
 *   counted as `unscheduledCount` so the UI can flag "needs scheduling".
 * - Assignments whose [plannedStart, plannedEnd] range stretches outside
 *   the visible Mon-Fri week count toward `outsideWeekCount`.
 *
 * Hard cap on spill walk: 365 days from plannedStart. Anything beyond
 * that is dropped to keep this loop bounded against pathological data.
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

  const weekStartIso = week[0]?.iso ?? '';
  const weekEndIso = week[week.length - 1]?.iso ?? '';

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
    list.sort((a, b) => {
      const pa = a.plannedStart ?? '';
      const pb = b.plannedStart ?? '';
      if (pa !== pb) return pa.localeCompare(pb);
      return a.createdAt.localeCompare(b.createdAt);
    });

    const userDaily = new Map<IsoDate, number>();
    for (const a of list) {
      // Spill-aware front-fill: start at plannedStart, keep walking working
      // days forward until plannedHours is satisfied (or we hit the safety
      // cap). plannedEnd is informational here.
      let remaining = a.plannedHours;
      const cursor = parseIsoDateUtc(a.plannedStart!.slice(0, 10));
      const horizon = addDaysUtc(cursor, 365);
      while (remaining > 0 && cursor.getTime() <= horizon.getTime()) {
        const day = cursor.getUTCDay();
        const isWeekend = day === 0 || day === 6;
        if (!isWeekend) {
          const iso = formatIsoDateUtc(cursor);
          const used = userDaily.get(iso) ?? 0;
          const avail = Math.max(0, dailyMax - used);
          if (avail > 0) {
            const take = Math.min(remaining, avail);
            userDaily.set(iso, used + take);
            remaining -= take;
          }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    for (const [iso, hours] of userDaily) {
      if (isoSet.has(iso)) {
        cells.set(`${userId}|${iso}`, hours);
      }
    }
  }

  return { cells, outsideWeekCount, unscheduledCount };
}

// --- date helpers (UTC, no DST surprises) -----------------------------------

function parseIsoDateUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10));
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

function addDaysUtc(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatIsoDateUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
