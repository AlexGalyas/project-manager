// Pure helpers for day-level scheduling. Shared between the API (optimizer +
// manual assignment endpoints) and the web (workload heatmap, task list).
//
// All dates are handled as ISO date-only strings in UTC: YYYY-MM-DD. This
// matches the MVP timezone assumption (see AGENTS.md). The helpers never
// touch wall-clock time; they only ever step day-by-day.

export type IsoDate = string; // YYYY-MM-DD

/** UTC midnight of the given Date, expressed as YYYY-MM-DD. */
export function toIsoDate(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD (or ISO datetime) back to a UTC-midnight Date. */
export function fromIsoDate(s: IsoDate | string): Date {
  // For "YYYY-MM-DD", construct UTC midnight directly so DST / local TZ
  // never enter the picture.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  return new Date(s);
}

/** True for Saturday (6) / Sunday (0) on the UTC calendar. */
export function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** UTC-step a date by `delta` days. */
export function addDaysUtc(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

/**
 * Enumerate working dates from `from` to `to` inclusive. Skips weekends
 * unless `includeWeekends` is true. Returns an empty array if `to < from`.
 */
export function workingDatesBetween(
  from: Date,
  to: Date,
  includeWeekends: boolean,
): IsoDate[] {
  const out: IsoDate[] = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor.getTime() <= end.getTime()) {
    if (includeWeekends || !isWeekend(cursor)) {
      out.push(toIsoDate(cursor));
    }
    cursor = addDaysUtc(cursor, 1);
  }
  return out;
}

/**
 * Front-fill `durationHours` over the date range, capping each day at
 * `maxHoursPerDay`. Skips weekends unless `includeWeekends`.
 *
 * Returns the per-day distribution it managed to place, plus how many
 * hours remain unplaced if the range ran out before `durationHours`
 * was satisfied. Caller decides what to do with `remainingHours > 0`
 * (e.g. mark the task as "no daily capacity before deadline").
 */
export function frontFillSchedule(opts: {
  from: Date;
  to: Date;
  durationHours: number;
  maxHoursPerDay: number;
  includeWeekends: boolean;
  /** Existing per-day load for this employee (subtracted from daily capacity). */
  existingDailyLoad?: ReadonlyMap<IsoDate, number>;
}): {
  distribution: Map<IsoDate, number>;
  remainingHours: number;
  plannedStart: IsoDate | null;
  plannedEnd: IsoDate | null;
} {
  const distribution = new Map<IsoDate, number>();
  let remaining = opts.durationHours;
  let plannedStart: IsoDate | null = null;
  let plannedEnd: IsoDate | null = null;

  for (const iso of workingDatesBetween(opts.from, opts.to, opts.includeWeekends)) {
    if (remaining <= 0) break;
    const used = opts.existingDailyLoad?.get(iso) ?? 0;
    const available = Math.max(0, opts.maxHoursPerDay - used);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    distribution.set(iso, take);
    remaining -= take;
    if (plannedStart === null) plannedStart = iso;
    plannedEnd = iso;
  }

  return { distribution, remainingHours: remaining, plannedStart, plannedEnd };
}

/**
 * Reconstruct an assignment's per-day distribution from `plannedStart`,
 * `plannedEnd`, `plannedHours` and the user's `maxHoursPerDay`. Front-fills
 * to match what the optimizer / manual auto-distribution produced. If the
 * range can absorb fewer hours than `plannedHours` (e.g. the manager
 * compressed an over-capacity span), the trailing days saturate at
 * `maxHoursPerDay` and the rest is dropped from the visualization.
 */
export function distributeAssignmentByDay(opts: {
  plannedStart: IsoDate | string;
  plannedEnd: IsoDate | string;
  plannedHours: number;
  maxHoursPerDay: number;
  includeWeekends: boolean;
}): Map<IsoDate, number> {
  const result = frontFillSchedule({
    from: fromIsoDate(opts.plannedStart),
    to: fromIsoDate(opts.plannedEnd),
    durationHours: opts.plannedHours,
    maxHoursPerDay: opts.maxHoursPerDay,
    includeWeekends: opts.includeWeekends,
  });
  return result.distribution;
}
