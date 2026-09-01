import { assert, beforeEach, describe, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { loadTryoutSignedContent } from "@repo/backend/convex/tryouts/runtime/selectors";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Data, Effect } from "effect";

class QueryFailure extends Data.TaggedError("QueryFailure")<{
  readonly message: string;
}> {}

/** Preserves one rejected Convex query as typed test evidence. */
function queryFailure(cause: unknown) {
  return new QueryFailure({
    message: cause instanceof Error ? cause.message : String(cause),
  });
}

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
});

describe("tryouts/runtime/selectors", () => {
  it.effect(
    "returns entitled answer selectors only after terminal review",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedTryoutContentAccessState(ctx, {
              attemptStatus: "completed",
              sectionStatus: "completed",
              suffix: "content-signed-review",
            })
          )
        );
        const content = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get(seeded.attemptId)
                );
                if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
                  return yield* Effect.die(
                    new Error("Expected a signed attempt fixture.")
                  );
                }
                return yield* loadTryoutSignedContent({
                  answers: true,
                  attempt,
                  ctx,
                  appLocale: "id",
                  sectionKey: TRYOUT_SECTION_KEY,
                  snapshotId: attempt.tryoutSnapshotId,
                  snapshotReleaseId: attempt.snapshotReleaseId,
                  totalQuestions: 1,
                });
              })
            )
          )
        );
        assert.deepStrictEqual(content, {
          answers: [seeded.signedContent.answer],
          kind: "signed",
          questions: [seeded.signedContent.question],
        });
      })
  );

  it.effect("fails closed when signed attempt locale identity drifts", () =>
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
                  suffix: "content-signed-locale",
                })
              );
              yield* Effect.promise(() =>
                ctx.db.patch(fixture.attemptId, { appLocale: "en" })
              );
              return fixture;
            })
          )
        )
      );
      const failure = yield* Effect.tryPromise({
        catch: queryFailure,
        try: () =>
          t.query((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get(seeded.attemptId)
                );
                if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
                  return yield* Effect.die(
                    new Error("Expected a signed attempt fixture.")
                  );
                }
                return yield* loadTryoutSignedContent({
                  answers: false,
                  attempt,
                  ctx,
                  appLocale: "id",
                  sectionKey: TRYOUT_SECTION_KEY,
                  snapshotId: attempt.tryoutSnapshotId,
                  snapshotReleaseId: attempt.snapshotReleaseId,
                  totalQuestions: 1,
                });
              })
            )
          ),
      }).pipe(Effect.flip);
      assert.ok(
        failure.message.includes(
          "Signed try-out attempt lost its locale or snapshot identity"
        )
      );
    })
  );

  it.effect("fails closed when one signed placement is missing", () =>
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
                  suffix: "content-signed-placement",
                })
              );
              if (!fixture.placementId) {
                return yield* Effect.die(
                  new Error("Expected a signed placement fixture.")
                );
              }
              yield* Effect.promise(() => ctx.db.delete(fixture.placementId));
              return fixture;
            })
          )
        )
      );
      const failure = yield* Effect.tryPromise({
        catch: queryFailure,
        try: () =>
          t.query((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get(seeded.attemptId)
                );
                if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
                  return yield* Effect.die(
                    new Error("Expected a signed attempt fixture.")
                  );
                }
                return yield* loadTryoutSignedContent({
                  answers: false,
                  attempt,
                  ctx,
                  appLocale: "id",
                  sectionKey: TRYOUT_SECTION_KEY,
                  snapshotId: attempt.tryoutSnapshotId,
                  snapshotReleaseId: attempt.snapshotReleaseId,
                  totalQuestions: 1,
                });
              })
            )
          ),
      }).pipe(Effect.flip);
      assert.ok(
        failure.message.includes(
          "Signed try-out section lost one or more frozen placements"
        )
      );
    })
  );

  it.effect("maps placement read failures into the typed selector error", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedTryoutContentAccessState(ctx, {
            attemptStatus: "in-progress",
            sectionStatus: "in-progress",
            suffix: "content-selector-read-failure",
          })
        )
      );
      const failure = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const attempt = yield* Effect.promise(() =>
                ctx.db.get(seeded.attemptId)
              );
              if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
                return yield* Effect.die(
                  new Error("Expected a signed attempt fixture.")
                );
              }
              vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
                throw new Error("Injected selector read failure.");
              });
              return yield* loadTryoutSignedContent({
                answers: false,
                attempt,
                ctx,
                appLocale: "id",
                sectionKey: TRYOUT_SECTION_KEY,
                snapshotId: attempt.tryoutSnapshotId,
                snapshotReleaseId: attempt.snapshotReleaseId,
                totalQuestions: 1,
              }).pipe(
                Effect.match({
                  onFailure: (error) => ({
                    code: error.code,
                    message: error.message,
                    tag: error._tag,
                  }),
                  onSuccess: () => null,
                })
              );
            })
          )
        )
      );
      assert.deepStrictEqual(failure, {
        code: "TRYOUT_SELECTOR_INTEGRITY",
        message: "Unable to read signed try-out selectors.",
        tag: "TryoutSelectorReadError",
      });
    })
  );
});
