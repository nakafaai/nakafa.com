import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import { describe, expect, it } from "vitest";

describe("tryouts/helpers/reporting", () => {
  it("maps theta onto the public 0-1000 report scale", () => {
    expect(getTryoutReportScore("snbt", -4)).toBe(0);
    expect(getTryoutReportScore("snbt", 0)).toBe(500);
    expect(getTryoutReportScore("snbt", 4)).toBe(1000);
    expect(getTryoutReportScore("snbt", -99)).toBe(0);
    expect(getTryoutReportScore("snbt", 99)).toBe(1000);
  });
});
