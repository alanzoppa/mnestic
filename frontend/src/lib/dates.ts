"use client";

import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subDays,
  subMonths,
  startOfYear,
  subYears,
  endOfYear,
  getDay,
  addYears,
  getYear,
  setYear,
} from "date-fns";

export { format, parseISO, isValid };

/** Format a Date to ISO date string (YYYY-MM-DD). */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Parse an ISO date string to a Date, returning null if invalid. */
export function parseISODate(str: string): Date | null {
  const d = parseISO(str);
  return isValid(d) ? d : null;
}

/** Validate an ISO date string. */
export function isISODateValid(str: string): boolean {
  return isValid(parseISO(str));
}

/** Format a Date for display: "Jan 15, 2024" */
export function formatDisplay(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d, yyyy");
}

/** Format a Date for display with day of week: "Mon, Jan 15, 2024" */
export function formatDisplayLong(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "EEE, MMM d, yyyy");
}

/** Format a period string: "Nov '23" */
export function formatPeriod(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM ''yy");
}

/** Get all days in a month, optionally with offset nulls for grid alignment. */
export function getMonthDays(
  year: number,
  month: number,
  weekStartsOn: 0 | 1 = 1
): (Date | null)[] {
  const base = new Date(year, month, 1);
  const start = startOfMonth(base);
  const end = endOfMonth(base);
  const days = eachDayOfInterval({ start, end });

  const firstDayOfWeek = getDay(start);
  const offset = (firstDayOfWeek - weekStartsOn + 7) % 7;

  const result: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) {
    result.push(null);
  }
  result.push(...days);
  while (result.length % 7 !== 0) {
    result.push(null);
  }
  return result;
}

/** Build date range presets used by DateRangePicker. */
export function getDatePresets(): {
  label: string;
  from: string;
  to: string;
}[] {
  const now = new Date();
  return [
    { label: "Last 30 days", from: toISODate(subDays(now, 30)), to: toISODate(now) },
    { label: "Last 90 days", from: toISODate(subDays(now, 90)), to: toISODate(now) },
    { label: "Last 6 months", from: toISODate(subMonths(now, 6)), to: toISODate(now) },
    { label: "Last year", from: toISODate(subYears(now, 1)), to: toISODate(now) },
    { label: "This year", from: toISODate(startOfYear(now)), to: toISODate(now) },
    {
      label: "Last year (full)",
      from: toISODate(startOfYear(subYears(now, 1))),
      to: toISODate(endOfYear(subYears(now, 1))),
    },
    { label: "All time", from: "", to: "" },
  ];
}

/** Get the year from a period string "yyyy-mm-dd" */
export function parsePeriodYear(period: string): number {
  return parseInt(period.slice(0, 4), 10);
}

/** Get unique sorted years from period strings */
export function getYearsFromPeriods(periods: { period: string }[]): number[] {
  const years = new Set(
    periods
      .map((p) => parsePeriodYear(p.period))
      .filter((y) => !isNaN(y))
  );
  return [...years].sort().reverse();
}

/** Set year on a date */
export function setDateYear(date: Date, year: number): Date {
  return setYear(date, year);
}
