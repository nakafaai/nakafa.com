import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { loadTryoutSignedContent } from "@repo/backend/convex/tryouts/runtime/selectors";
import {
  TEST_STORED_TRYOUT_PLACEMENT,
  TEST_STORED_TRYOUT_RELEASE_ID,
  TEST_STORED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/test/tryout-history";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout-runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
});

describe("tryouts/runtime/selectors", () => {
  it.effect("returns signed selectors for the active attempt", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedTryoutContentAccessState(ctx, {
            attemptStatus: "in-progress",
            sectionStatus: "in-progress",
            suffix: "content-signed-active",
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
        )
      );
      expect(content).toEqual({
        answers: [],
        kind: "signed",
        questions: [seeded.signedContent.question],
        runtime: "current",
      });
    })
  );

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
        expect(content).toEqual({
          answers: [seeded.signedContent.answer],
          kind: "signed",
          questions: [seeded.signedContent.question],
          runtime: "current",
        });
      })
  );

  it.effect(
    "selects authenticated history only through an attempt marker",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const fixture = yield* Effect.promise(() =>
                  seedTryoutContentAccessState(ctx, {
                    attemptStatus: "completed",
                    sectionStatus: "completed",
                    suffix: "content-stored-review",
                  })
                );
                if (!fixture.placementId) {
                  return yield* Effect.die(
                    new Error("Expected one frozen placement fixture.")
                  );
                }
                const historical = TEST_STORED_TRYOUT_PLACEMENT.record.row;
                yield* Effect.promise(() =>
                  ctx.db.patch(fixture.attemptId, {
                    appLocale: "id",
                    snapshotReleaseId: TEST_STORED_TRYOUT_RELEASE_ID,
                    tryoutSnapshotId: TEST_STORED_TRYOUT_SNAPSHOT_ID,
                  })
                );
                yield* Effect.promise(() =>
                  ctx.db.patch(fixture.placementId, {
                    answerArtifactHash: historical.answerArtifactHash,
                    answerContentKey: historical.answerContentKey,
                    choiceSnapshots: [...historical.choices],
                    contentHash: historical.contentHash,
                    placementRowHash:
                      TEST_STORED_TRYOUT_PLACEMENT.record.rowHash,
                    questionArtifactHash: historical.questionArtifactHash,
                    questionContentKey: historical.questionContentKey,
                    questionOrder: historical.questionOrder,
                    rendererDomain: historical.rendererDomain,
                    sectionKey: historical.sectionKey,
                    sourcePath: historical.questionSourcePath,
                    sourceRevision: historical.sourceRevision,
                  })
                );
                yield* Effect.promise(() =>
                  ctx.db.insert("tryoutHistoryRows", {
                    answerArtifactHash: historical.answerArtifactHash,
                    index: 0,
                    questionArtifactHash: historical.questionArtifactHash,
                    rowHash: TEST_STORED_TRYOUT_PLACEMENT.record.rowHash,
                    rowJson: JSON.stringify(TEST_STORED_TRYOUT_PLACEMENT),
                    rowKind: "placement",
                    snapshotId: TEST_STORED_TRYOUT_SNAPSHOT_ID,
                  })
                );
                yield* Effect.promise(() =>
                  ctx.db.insert("tryoutAttemptHistory", {
                    snapshotReleaseId: TEST_STORED_TRYOUT_RELEASE_ID,
                    tryoutAttemptId: fixture.attemptId,
                    tryoutSnapshotId: TEST_STORED_TRYOUT_SNAPSHOT_ID,
                  })
                );
                return fixture;
              })
            )
          )
        );
        const content = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const attempt = yield* Effect.promise(() =>
                  ctx.db.get("tryoutAttempts", seeded.attemptId)
                );
                if (!attempt) {
                  return yield* Effect.die(
                    new Error("Expected one retained attempt fixture.")
                  );
                }
                return yield* loadTryoutSignedContent({
                  answers: true,
                  appLocale: "id",
                  attempt,
                  ctx,
                  sectionKey:
                    TEST_STORED_TRYOUT_PLACEMENT.record.row.sectionKey,
                  snapshotId: TEST_STORED_TRYOUT_SNAPSHOT_ID,
                  snapshotReleaseId: TEST_STORED_TRYOUT_RELEASE_ID,
                  totalQuestions: 1,
                });
              })
            )
          )
        );
        expect(content).toMatchObject({
          answers: [
            {
              appLocale: "id",
              artifactLocale: "en",
              delivery: "entitled",
            },
          ],
          attemptId: seeded.attemptId,
          kind: "signed",
          questions: [
            {
              appLocale: "id",
              artifactLocale: "en",
              delivery: "authenticated",
            },
          ],
          runtime: "history",
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
      yield* Effect.promise(() =>
        expect(
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
          )
        ).rejects.toThrow(
          "Signed try-out attempt lost its locale or snapshot identity."
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
      yield* Effect.promise(() =>
        expect(
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
          )
        ).rejects.toThrow(
          "Signed try-out section lost one or more frozen placements."
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
      expect(failure).toMatchObject({
        code: "TRYOUT_SELECTOR_INTEGRITY",
        message: "Unable to read signed try-out selectors.",
        tag: "TryoutSelectorReadError",
      });
    })
  );
});
