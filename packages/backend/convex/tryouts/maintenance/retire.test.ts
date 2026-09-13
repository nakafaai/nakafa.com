import { assert, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

const MAX_BATCHES = 64;

describe("tryouts/maintenance/retire", () => {
  it.effect("drains one user's frozen try-out rows in bounded batches", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) =>
          seedTryoutContentAccessState(ctx, {
            attemptStatus: "completed",
            sectionStatus: "completed",
            suffix: "retire-frozen",
          })
        )
      );
      const outcome = yield* Effect.promise(async () => {
        let processed = 0;
        let drained = false;
        while (processed < MAX_BATCHES) {
          const hasMore = await t.mutation(
            internal.tryouts.maintenance.retire.retireFrozenTryouts,
            { userId: seeded.identity.userId }
          );
          processed += 1;
          if (!hasMore) {
            drained = true;
            break;
          }
        }
        return { drained, processed };
      });
      assert.ok(outcome.drained);
      assert.ok(outcome.processed > 1);
      const attempt = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.get("tryoutAttempts", seeded.attemptId))
      );
      expect(attempt).toBeNull();
    })
  );
});
