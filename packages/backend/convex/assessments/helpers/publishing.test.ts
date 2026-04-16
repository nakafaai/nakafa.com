import { validateScheduledStatus } from "@repo/backend/convex/assessments/helpers/publishing";
import { NOW } from "@repo/backend/convex/assessments/seed";
import { describe, expect, it, vi } from "vitest";

describe("assessments/helpers/publishing", () => {
  it("requires scheduled assessments to use a future publish timestamp", () => {
    vi.setSystemTime(new Date(NOW));

    expect(() => validateScheduledStatus("scheduled", undefined)).toThrow(
      "Scheduled assessments require a publish timestamp."
    );
    expect(() => validateScheduledStatus("scheduled", NOW - 1)).toThrow(
      "Scheduled assessments require a future publish timestamp."
    );
    expect(() =>
      validateScheduledStatus("scheduled", NOW + 60_000)
    ).not.toThrow();
    expect(() => validateScheduledStatus("draft", undefined)).not.toThrow();
  });
});
