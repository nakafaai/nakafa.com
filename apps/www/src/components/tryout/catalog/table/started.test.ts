import { describe, expect, it } from "@effect/vitest";
import { isUnstartedSet } from "@/components/tryout/catalog/table/started";

describe("isUnstartedSet", () => {
  it("opens the pane only for a set the learner has never started", () => {
    expect(isUnstartedSet({ attemptStatus: null })).toBe(true);
    expect(isUnstartedSet({ attemptStatus: "in-progress" })).toBe(false);
    expect(isUnstartedSet({ attemptStatus: "completed" })).toBe(false);
  });
});
