import { describe, expect, it } from "@effect/vitest";
import { getTryoutFinishedSectionStatus } from "@/components/tryout/section/finished";

describe("try-out finished section state", () => {
  it("preserves the terminal status stored by Convex", () => {
    expect(getTryoutFinishedSectionStatus(null)).toBeNull();
    expect(
      getTryoutFinishedSectionStatus({ status: "in-progress" })
    ).toBeNull();
    expect(getTryoutFinishedSectionStatus({ status: "completed" })).toBe(
      "completed"
    );
    expect(getTryoutFinishedSectionStatus({ status: "expired" })).toBe(
      "expired"
    );
  });
});
