import { describe, expect, it } from "vitest";
import {
  getTryoutFinishedSectionDescription,
  getTryoutFinishedSectionStatus,
} from "@/components/tryout/section/finished";

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

  it.each([
    [true, true, "part-head-completed-time-expired"],
    [false, true, "part-head-completed-time-expired-pending-review"],
    [true, false, "part-head-completed"],
    [false, false, "part-head-completed-pending-review"],
  ] as const)("selects the finished description for attempt=%s expired=%s", (attemptFinished, sectionTimeExpired, expected) => {
    expect(
      getTryoutFinishedSectionDescription({
        attemptFinished,
        sectionTimeExpired,
        tTryouts: (key) => key,
      })
    ).toBe(expected);
  });
});
