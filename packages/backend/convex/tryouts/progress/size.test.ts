import { describe, expect, it } from "@effect/vitest";
import { TRYOUT_PROGRESS_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import {
  ensureTryoutProgressWithinReadBudget,
  isTryoutProgressWithinReadBudget,
} from "@repo/backend/convex/tryouts/progress/size";
import { Effect } from "effect";

const compactProgress = Object.freeze({
  appLocale: "id",
  attemptNumber: 1,
  countryKey: "indonesia",
  examKey: "snbt",
  latestAttemptId: "attempt-id",
  publishedScore: null,
  setIdentity: "id\0set\0indonesia\0snbt\u0417\0set-1\0",
  setKey: "set-1",
  status: "in-progress",
  statusRank: 1,
  trackKey: "2027",
  updatedAt: 1,
  userId: "user-id",
});

describe("tryouts/progress/size", () => {
  it("accepts one compact signed progress row", () => {
    expect(isTryoutProgressWithinReadBudget(compactProgress)).toBe(true);
  });

  it.live("rejects a row that consumes its complete byte reservation", () =>
    Effect.gen(function* () {
      expect(
        yield* ensureTryoutProgressWithinReadBudget({
          ...compactProgress,
          setIdentity: "x".repeat(TRYOUT_PROGRESS_DOCUMENT_LIMIT),
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "TryoutProgressSizeError",
        code: "TRYOUT_PROGRESS_SIZE",
        message: "Try-out progress exceeds the signed catalog read budget.",
      });
    })
  );
});
