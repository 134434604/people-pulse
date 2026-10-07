import { describe, expect, it } from "vitest";
import { findUpcomingAnniversaries, parseSheetDate } from "../src/domain/anniversaries.js";
import type { Employee } from "../src/domain/types.js";

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    employeeId: "E-1", active: true, firstName: "Jordan", lastName: "Lee", preferredName: "Jordan",
    displayName: "Jordan Lee", hireDate: "2021-07-20", department: "People", slackUserId: "U123", toneNotes: "", ...overrides
  };
}

describe("parseSheetDate", () => {
  it("ports the supported Apps Script date formats", () => {
    expect(parseSheetDate("2020-06-12")).toMatchObject({ valid: true, year: 2020, month: 6, day: 12, hasYear: true });
    expect(parseSheetDate("6/12/2020")).toMatchObject({ valid: true, year: 2020, month: 6, day: 12 });
    expect(parseSheetDate("June 12, 2020")).toMatchObject({ valid: true, year: 2020, month: 6, day: 12 });
    expect(parseSheetDate("not a date").valid).toBe(false);
  });
});

describe("findUpcomingAnniversaries", () => {
  it("returns active employees in the next seven days and calculates service", () => {
    const result = findUpcomingAnniversaries([
      employee(),
      employee({ employeeId: "E-2", hireDate: "2021-07-27" }),
      employee({ employeeId: "E-3", active: false })
    ], new Date("2026-07-20T12:00:00Z"), 7);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ yearsOfService: 5, occurrenceDate: "2026-07-20", queueId: "E-1_ANNIVERSARY_2026" });
  });

  it("handles a week crossing into a new year", () => {
    const result = findUpcomingAnniversaries([employee({ hireDate: "2020-01-02" })], new Date("2025-12-29T12:00:00Z"), 7);
    expect(result[0]).toMatchObject({ year: 2026, yearsOfService: 6, occurrenceDate: "2026-01-02" });
  });

  it("observes February 29 anniversaries on February 28 in non-leap years", () => {
    const result = findUpcomingAnniversaries([employee({ hireDate: "2020-02-29" })], new Date("2026-02-23T12:00:00Z"), 7);
    expect(result[0]).toMatchObject({ occurrenceDate: "2026-02-28", yearsOfService: 6 });
  });
});
