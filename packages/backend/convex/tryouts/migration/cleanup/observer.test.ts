import { assert, describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  cleanupObserver,
  requireCleanupObserver,
} from "@repo/backend/convex/tryouts/migration/cleanup/observer";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import {
  PREDECESSOR_OBSERVATION_ID,
  seedSealedPredecessorObservation,
} from "@repo/backend/test/predecessor";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

type ObserverTest = TestConvex<typeof schema>;

/** Seeds one complete sealed predecessor observation. */
function seedObserver(t: ObserverTest) {
  return t.mutation(async (ctx) => {
    await insertRuntimeRelease(ctx);
    await seedSealedPredecessorObservation(ctx);
  });
}

describe("tryouts/migration/cleanup/observer", () => {
  it.effect("rejects a predecessor row restored after deletion", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() => seedObserver(t));
      const row = yield* Effect.promise(() =>
        t.query((ctx) =>
          ctx.db
            .query("contentPredecessorReads")
            .withIndex("by_route", (query) => query.eq("route", "singular"))
            .unique()
        )
      );
      assert.ok(row);
      assert.ok(row.sealedAt !== undefined);

      const page = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(cleanupObserver(ctx, PREDECESSOR_OBSERVATION_ID))
        )
      );
      assert.deepStrictEqual(page, { deleted: 4, kind: "observer" });

      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("contentPredecessorReads", {
            activeManifestHash: row.activeManifestHash,
            activeReleaseId: row.activeReleaseId,
            activeSequence: row.activeSequence,
            armedAt: row.armedAt,
            deploymentName: row.deploymentName,
            invocationCount: row.invocationCount,
            observationId: row.observationId,
            phase: row.phase,
            quietSince: row.quietSince,
            route: row.route,
            sealedAt: row.sealedAt,
          })
        )
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(
              requireCleanupObserver(ctx, PREDECESSOR_OBSERVATION_ID, true)
            )
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
          message: expect.stringContaining("restored a deleted predecessor"),
        })
      );
    })
  );
});
