import {
  getAttemptEndReasonFromStatus,
  getAttemptStatusFromEndReason,
} from "@repo/backend/convex/lib/attempts";
import { describe, expect, it } from "vitest";

describe("lib/attempts", () => {
  it("maps finalized attempt statuses to persisted end reasons", () => {
    expect(getAttemptEndReasonFromStatus("completed")).toBe("submitted");
    expect(getAttemptEndReasonFromStatus("expired")).toBe("time-expired");
  });

  it("maps persisted end reasons to finalized attempt statuses", () => {
    expect(getAttemptStatusFromEndReason("submitted")).toBe("completed");
    expect(getAttemptStatusFromEndReason("time-expired")).toBe("expired");
  });
});
