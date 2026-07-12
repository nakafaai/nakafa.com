import { describe, expect, it } from "vitest";
import {
  isTryoutSetStatusFilter,
  readTryoutSetAttemptStatus,
  readTryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/filter";

describe("try-out set status filtering", () => {
  it("reads only supported status filter values", () => {
    expect(
      ["all", "not-started", "in-progress", "completed", "expired"].every(
        isTryoutSetStatusFilter
      )
    ).toBe(true);
    expect(isTryoutSetStatusFilter("unknown")).toBe(false);
    expect(readTryoutSetStatusFilter([])).toBe("all");
    expect(
      readTryoutSetStatusFilter([{ id: "attemptStatus", value: "not-started" }])
    ).toBe("not-started");
    expect(
      readTryoutSetStatusFilter([{ id: "attemptStatus", value: "in-progress" }])
    ).toBe("in-progress");
    expect(
      readTryoutSetStatusFilter([{ id: "attemptStatus", value: "completed" }])
    ).toBe("completed");
    expect(
      readTryoutSetStatusFilter([{ id: "attemptStatus", value: "expired" }])
    ).toBe("expired");
    expect(
      readTryoutSetStatusFilter([{ id: "attemptStatus", value: "unknown" }])
    ).toBe("all");
  });

  it("narrows only persisted attempt statuses", () => {
    expect(readTryoutSetAttemptStatus("all")).toBeNull();
    expect(readTryoutSetAttemptStatus("not-started")).toBeNull();
    expect(readTryoutSetAttemptStatus("in-progress")).toBe("in-progress");
    expect(readTryoutSetAttemptStatus("completed")).toBe("completed");
    expect(readTryoutSetAttemptStatus("expired")).toBe("expired");
  });
});
