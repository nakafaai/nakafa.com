import { getAttemptEndReasonFromStatus } from "@repo/backend/convex/lib/attempts";
import { describe, expect, it } from "vitest";

describe("lib/attempts", () => {
  it("maps finalized attempt statuses to persisted end reasons", () => {
    expect(getAttemptEndReasonFromStatus("completed")).toBe("submitted");
    expect(getAttemptEndReasonFromStatus("expired")).toBe("time-expired");
  });
});
