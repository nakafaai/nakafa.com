import { assert, beforeEach, describe, it } from "@effect/vitest";
import { decodeArtifactJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { readTryoutHistory } from "@repo/backend/convex/tryouts/runtime/history/read";
import type { TryoutHistoryRequest } from "@repo/backend/convex/tryouts/runtime/history/spec";
import { insertHistoryAttempt } from "@repo/backend/test/tryout/history";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

async function setup() {
  const t = createConvexTestWithBetterAuth();
  const seed = await t.mutation((ctx) => insertHistoryAttempt(ctx, true));
  const owned = t.withIdentity({
    subject: seed.identity.authUserId,
    sessionId: seed.identity.sessionId,
  });
  return { owned, seed, t };
}

function readFailure(
  t: Pick<ReturnType<typeof createConvexTestWithBetterAuth>, "query">,
  request: TryoutHistoryRequest
) {
  return t.query((ctx) =>
    runConvexProgram(
      readTryoutHistory(ctx, request).pipe(
        Effect.match({
          onFailure: ({ code, message }) => ({ code, message }),
          onSuccess: () => ({
            code: "UNEXPECTED_SUCCESS",
            message: "Expected a typed failure.",
          }),
        })
      )
    )
  );
}

beforeEach(() => vi.setSystemTime(new Date(TRYOUT_TEST_NOW)));

describe("tryouts/runtime/history/placement", () => {
  it.effect(
    "withholds an unstarted or completed section during an active attempt",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(setup);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch(seed.request.attemptId, { status: "in-progress" })
          )
        );
        assert.isNull(
          yield* Effect.promise(() =>
            owned.query((ctx) =>
              runConvexProgram(readTryoutHistory(ctx, seed.request))
            )
          )
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) => ctx.db.delete(seed.sectionId))
        );
        assert.isNull(
          yield* Effect.promise(() =>
            owned.query((ctx) =>
              runConvexProgram(readTryoutHistory(ctx, seed.request))
            )
          )
        );
      })
  );

  it.effect(
    "rejects section state that no longer belongs to the frozen section",
    () =>
      Effect.gen(function* () {
        const { owned, seed, t } = yield* Effect.promise(setup);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch(seed.sectionId, { sectionIdentity: "foreign-section" })
          )
        );
        const error = yield* Effect.promise(() =>
          readFailure(owned, seed.request)
        );
        assert.deepStrictEqual(error, {
          code: "TRYOUT_HISTORY_INTEGRITY",
          message: "Try-out section lost its frozen identity.",
        });
      })
  );

  it.effect("rejects a missing original artifact", () =>
    Effect.gen(function* () {
      const { owned, seed, t } = yield* Effect.promise(setup);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const artifact = await ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (index) =>
              index.eq("artifactHash", seed.fixture.question.artifactHash)
            )
            .unique();
          assert.isNotNull(artifact);
          await ctx.db.delete(artifact._id);
        })
      );
      const error = yield* Effect.promise(() =>
        readFailure(owned, seed.request)
      );
      assert.deepStrictEqual(error, {
        code: "TRYOUT_HISTORY_INTEGRITY",
        message: "Try-out placement lost its signed body.",
      });
    })
  );

  it.effect("rejects a stored artifact reassigned to another locale", () =>
    Effect.gen(function* () {
      const { owned, seed, t } = yield* Effect.promise(setup);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const stored = await ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (index) =>
              index.eq("artifactHash", seed.fixture.question.artifactHash)
            )
            .unique();
          assert.isNotNull(stored);
          const artifact = await runConvexProgram(
            decodeArtifactJson(stored.artifactJson)
          );
          await ctx.db.patch(stored._id, {
            artifactJson: JSON.stringify({
              ...artifact,
              payload: { ...artifact.payload, artifactLocale: "id" },
            }),
          });
        })
      );
      const error = yield* Effect.promise(() =>
        readFailure(owned, seed.request)
      );
      assert.deepStrictEqual(error, {
        code: "TRYOUT_HISTORY_INTEGRITY",
        message: "Try-out body changed its frozen identity.",
      });
    })
  );
});
