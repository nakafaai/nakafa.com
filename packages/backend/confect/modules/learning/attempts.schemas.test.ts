import { describe, expect, it } from "@effect/vitest";
import { getAttemptEndReasonFromStatus } from "@repo/backend/confect/modules/learning/attempts.schemas";
import { Effect } from "effect";

describe("attempt end reasons", () => {
  it.effect("maps finalized statuses to persisted end reasons", () =>
    Effect.sync(() => {
      expect(getAttemptEndReasonFromStatus("completed")).toBe("submitted");
      expect(getAttemptEndReasonFromStatus("expired")).toBe("time-expired");
    })
  );
});
