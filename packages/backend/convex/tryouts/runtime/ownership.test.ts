import { assert, beforeEach, describe, it, vi } from "@effect/vitest";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { loadTryoutSignedContent } from "@repo/backend/convex/tryouts/runtime/selectors";
import { insertRetainedRuntime } from "@repo/backend/test/runtime/retained";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Data, Effect } from "effect";

type ConvexHarness = ReturnType<typeof createConvexTestWithBetterAuth>;

class QueryFailure extends Data.TaggedError("QueryFailure")<{
  readonly message: string;
}> {}

/** Preserves one rejected Convex query as typed test evidence. */
function queryFailure(cause: unknown) {
  return new QueryFailure({
    message: cause instanceof Error ? cause.message : String(cause),
  });
}

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

      assert.strictEqual(content.runtime, "current");
      assert.strictEqual(content.questions.length, 1);
    })
  );

  it.effect("selects predecessor runtime without a history marker", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const fixture = yield* Effect.promise(() =>
                seedTryoutContentAccessState(ctx, {
                  attemptStatus: "in-progress",
                  sectionStatus: "in-progress",
                  suffix: "ownership-predecessor",
                })
              );
              const releaseId =
                fixture.signedContent.question.snapshotReleaseId;
              const release = yield* Effect.promise(() =>
                ctx.db
                  .query("contentReleases")
                  .withIndex("by_releaseId", (query) =>
                    query.eq("releaseId", releaseId)
                  )
                  .unique()
              );
              if (!release) {
                return yield* Effect.die(
                  "Expected one predecessor release fixture."
                );
              }
              const signed = yield* decodeReleaseJson(release.releaseJson);
              yield* Effect.promise(() =>
                ctx.db.patch(fixture.attemptId, {
                  tryoutBundleHash: undefined,
                  tryoutBundleId: undefined,
                })
              );
              yield* Effect.promise(() =>
                ctx.db.insert("tryoutBundles", {
                  createdAt: 1,
                  index: 0,
                  manifestHash: signed.manifestHash,
                  releaseId,
                  releaseJson: release.releaseJson,
                  rendererJson: release.rendererJson,
                  snapshotId: fixture.signedContent.question.snapshotId,
                })
              );
              return fixture;
            })
          )
        )
      );

      const content = yield* Effect.promise(() =>
        readAttemptContent(t, {
          attemptId: seeded.attemptId,
          sectionKey: TRYOUT_SECTION_KEY,
        })
      );

      assert.strictEqual(content.runtime, "predecessor");
      assert.strictEqual(content.questions.length, 1);
      assert.strictEqual("bundleHash" in (content.questions[0] ?? {}), false);
    })
  );

  it.effect("selects retained history with its required legacy bundle", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const retained = yield* Effect.promise(() =>
        t.mutation((ctx) => insertRetainedRuntime(ctx, { appLocale: "id" }))
      );

      const content = yield* Effect.promise(() =>
        readAttemptContent(t, {
          attemptId: retained.request.attemptId,
          sectionKey: "general-reasoning",
        })
      );

      assert.strictEqual(content.runtime, "history");
      if (content.runtime !== "history") {
        return yield* Effect.die("Expected retained history content.");
      }
      assert.strictEqual(String(content.attemptId), retained.request.attemptId);
      assert.strictEqual(content.questions[0]?.artifactLocale, "en");
    })
  );

  it.effect("rejects a history marker with permanent attempt ownership", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const fixture = await seedTryoutContentAccessState(ctx, {
            attemptStatus: "in-progress",
            sectionStatus: "in-progress",
            suffix: "ownership-duplicate",
          });
          await ctx.db.insert("tryoutAttemptHistory", {
            snapshotReleaseId: fixture.signedContent.question.snapshotReleaseId,
            tryoutAttemptId: fixture.attemptId,
            tryoutSnapshotId: fixture.signedContent.question.snapshotId,
          });
          return fixture;
        })
      );

      const failure = yield* Effect.tryPromise({
        catch: queryFailure,
        try: () =>
          readAttemptContent(t, {
            attemptId: seeded.attemptId,
            sectionKey: TRYOUT_SECTION_KEY,
          }),
      }).pipe(Effect.flip);

      assert.ok(
        failure.message.includes(
          "both permanent and historical runtime ownership"
        )
      );
    })
  );

  it.effect("rejects an attempt without any immutable runtime owner", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const fixture = await seedTryoutContentAccessState(ctx, {
            attemptStatus: "in-progress",
            sectionStatus: "in-progress",
            suffix: "ownership-orphan",
          });
          await ctx.db.patch(fixture.attemptId, {
            tryoutBundleHash: undefined,
            tryoutBundleId: undefined,
          });
          return fixture;
        })
      );

      const failure = yield* Effect.tryPromise({
        catch: queryFailure,
        try: () =>
          readAttemptContent(t, {
            attemptId: seeded.attemptId,
            sectionKey: TRYOUT_SECTION_KEY,
          }),
      }).pipe(Effect.flip);

      assert.ok(failure.message.includes("has no immutable runtime owner"));
    })
  );
});
