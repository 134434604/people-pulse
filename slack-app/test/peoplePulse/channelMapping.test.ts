import { describe, expect, it } from "vitest";
import { proposeDepartmentChannelMappings } from "../../src/peoplePulse/channelMapping.js";

describe("proposeDepartmentChannelMappings", () => {
  it.each([
    ["Engineering", "engineering", true],
    ["Engineering", "engineering-platform", true],
    ["Engineering", "dept-engineering", true],
    ["Engineering", "team-engineering-alerts", true],
    ["Customer Support", "customer-support", true],
    ["Customer Support", "customer-support-team", true],
    ["Sales & Partnerships", "sales-and-partnerships", true],
    ["Marketing", "marketing-launches", true],
    ["Marketing", "market-research", false],
    ["Sales", "salesforce-admin", false],
    ["People", "people-pulse", true],
    ["Support", "customer-support", false]
  ])("matches %s to #%s = %s", (department, name, expected) => {
    const proposals = proposeDepartmentChannelMappings(
      [{ name: department }],
      [{ id: "CABC123", name, isPrivate: false, isArchived: false }]
    );
    expect(proposals.length > 0).toBe(expected);
  });

  it("never proposes private or archived channels and defaults Include to false", () => {
    const proposals = proposeDepartmentChannelMappings(
      [{ name: "Marketing" }],
      [
        { id: "CPRIV01", name: "marketing-private", isPrivate: true, isArchived: false },
        { id: "CARCH01", name: "marketing-old", isPrivate: false, isArchived: true },
        { id: "CPUB001", name: "marketing-launches", isPrivate: false, isArchived: false }
      ]
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ channelId: "CPUB001", include: false, approvedBy: "", approvedDate: "" });
  });
});
