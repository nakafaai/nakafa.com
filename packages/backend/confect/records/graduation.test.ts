import { describe, expect, it } from "@effect/vitest";
import { suggestedDate } from "@repo/backend/confect/records/graduation";

describe("records/graduation", () => {
  it("suggests the first Monday of June for primary education and of May for secondary", () => {
    expect(suggestedDate("smp", "2027-06-19")).toBe("2027-06-07");
    expect(suggestedDate("sd", "2026-06-19")).toBe("2026-06-01");
    expect(suggestedDate("sma", "2027-06-19")).toBe("2027-05-03");
    expect(suggestedDate("smk", "2026-06-19")).toBe("2026-05-04");
    expect(suggestedDate("ma", "2026-06-19")).toBe("2026-05-04");
  });
});
