import { assert, beforeEach, describe, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { loadTryoutSignedContent } from "@repo/backend/convex/tryouts/runtime/selectors";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Effect } from "effect";

type ConvexHarness = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Reads one attempt through the real signed selector ownership boundary. */
function readAttemptContent(
  t: ConvexHarness,
  input: {
    readonly attemptId: string;
    readonly sectionKey: string;
  }
) {
  return t.query((ctx) =>
    runConvexProgram(
      Effect.gen(function* () {
        const attemptId = ctx.db.normalizeId("tryoutAttempts", input.attemptId);
        if (!attemptId) {
          return yield* Effect.die("Expected one valid attempt identifier.");
        }
        const attempt = yield* Effect.promise(() => ctx.db.get(attemptId));
        if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
          return yield* Effect.die("Expected one signed attempt fixture.");
        }
        return yield* loadTryoutSignedContent({
          answers: false,
          appLocale: attempt.appLocale,
          attempt,
          ctx,
          sectionKey: input.sectionKey,
          snapshotId: attempt.tryoutSnapshotId,
          snapshotReleaseId: attempt.snapshotReleaseId,
          totalQuestions: 1,
        });
      })
    )
  );
}

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
});

describe("tryouts/runtime/ownership", () => {
  it.effect("selects permanent runtime without a history marker", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedTryoutContentAccessState(ctx, {
            attemptStatus: "in-progress",
            sectionStatus: "in-progress",
            suffix: "ownership-permanent",
          })
        )
      );

      const content = yield* Effect.promise(() =>
        readAttemptContent(t, {
          attemptId: seeded.attemptId,
          sectionKey: TRYOUT_SECTION_KEY,
        })
      );

      assert.strictEqual(content.kind, "signed");
      assert.strictEqual(content.questions.length, 1);
    })
  );
});
