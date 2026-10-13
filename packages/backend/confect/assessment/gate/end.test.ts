import { describe, expect, it } from "@effect/vitest";
import { statusOf } from "@repo/backend/confect/assessment/gate/end";

describe("assessment/gate/end", () => {
  it("maps persisted end reasons to finalized attempt statuses", () => {
    expect(statusOf("submitted")).toBe("completed");
    expect(statusOf("time-expired")).toBe("expired");
  });
});
