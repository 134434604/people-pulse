import type { Anniversary, Employee, SheetValue } from "./types.js";

export interface ParsedDate {
  valid: boolean;
  year: number;
  month: number;
  day: number;
  hasYear: boolean;
}

function validDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseSheetDate(value: SheetValue): ParsedDate {
  if (value === null || value === undefined || value === "") return { valid: false, year: 0, month: 0, day: 0, hasYear: false };
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86_400_000));
    return { valid: true, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hasYear: true };
  }
  const text = String(value).trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return parsed(Number(match[1]), Number(match[2]), Number(match[3]), true);
  match = text.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (match) {
    let year = match[3] ? Number(match[3]) : 2020;
    if (year > 0 && year < 100) year += year >= 50 ? 1900 : 2000;
    return parsed(year, Number(match[1]), Number(match[2]), Boolean(match[3]));
  }
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  match = text.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{2,4}))?$/);
  if (match) {
    const month = monthNames.findIndex((name) => name.startsWith(match![1]!.toLowerCase())) + 1;
    let year = match[3] ? Number(match[3]) : 2020;
    if (year > 0 && year < 100) year += year >= 50 ? 1900 : 2000;
    return parsed(year, month, Number(match[2]), Boolean(match[3]));
  }
  return { valid: false, year: 0, month: 0, day: 0, hasYear: false };
}

function parsed(year: number, month: number, day: number, hasYear: boolean): ParsedDate {
  return { valid: validDate(year || 2020, month, day), year, month, day, hasYear };
}

function occurrenceForYear(hire: ParsedDate, year: number): Date {
  if (hire.month === 2 && hire.day === 29 && !validDate(year, 2, 29)) return new Date(Date.UTC(year, 1, 28));
  return new Date(Date.UTC(year, hire.month - 1, hire.day));
}

export function findUpcomingAnniversaries(employees: Employee[], start: Date, lookaheadDays: number): Anniversary[] {
  const startDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endExclusive = new Date(startDay.getTime() + lookaheadDays * 86_400_000);
  const results: Anniversary[] = [];
  for (const employee of employees) {
    if (!employee.active || !employee.employeeId) continue;
    const hire = parseSheetDate(employee.hireDate);
    if (!hire.valid || !hire.hasYear) continue;
    for (const year of [startDay.getUTCFullYear(), startDay.getUTCFullYear() + 1]) {
      const occurrence = occurrenceForYear(hire, year);
      if (occurrence < startDay || occurrence >= endExclusive) continue;
      const years = year - hire.year;
      if (years <= 0) continue;
      results.push({
        employee,
        occurrenceDate: occurrence.toISOString().slice(0, 10),
        year,
        yearsOfService: years,
        queueId: `${employee.employeeId}_ANNIVERSARY_${year}`
      });
    }
  }
  return results.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || a.employee.displayName.localeCompare(b.employee.displayName));
}
