import { assert, describe, expect, it } from "@effect/vitest";
import practice from "@repo/backend/confect/_generated/refs/practice";
import tryoutsInternal from "@repo/backend/confect/_generated/refs/tryouts.server";
import { isSnapshotReferenced } from "@repo/backend/confect/contentRelease/snapshot/retention";
import { repinSnapshotPage } from "@repo/backend/confect/tryouts/repin";
import { FIXTURE_TRACK } from "@repo/backend/test/assessment/catalog";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Option } from "effect";

const PRACTICE_TARGET = {
  ...FIXTURE_TRACK,
  locale: "id",
  sectionKey: "section-a",
  setKey: "set-1",
} as const;

describe("tryouts/repin", () => {
  it.effect("refuses to re-pin the currently active snapshot onto itself", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      const failure = yield* world.internal
        .mutation(tryoutsInternal.mutations.repin.page, {
          fromSnapshotId: world.snapshotId,
        })
        .pipe(Effect.flip);
      assert.ok(failure._tag === "ReleaseError", "Expected ReleaseError.");
      expect(failure.code).toBe("CONTENT_RELEASE_INTEGRITY");
    })
  );

  it.effect(
    "re-pins compatible attempts, placements, scores, and practice sessions so the retired snapshot drops all learner references",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ languages: ["id"] });
        const { attemptId } = yield* world.start({ entry: false });
        yield* world.startSection(attemptId, "section-a");
        yield* world.answer(attemptId, {
          order: 1,
          pick: "correct",
          section: "section-a",
        });
        yield* world.completeSection(attemptId, "section-a");
        yield* world.startSection(attemptId, "section-b");
        yield* world.completeSection(attemptId, "section-b");

        // Also start an in-progress attempt (no tryoutScores row yet).
        const { attemptId: activeAttemptId } = yield* world.start({
          entry: false,
        });

        const { sessionId } = yield* world.learner.mutation(
          practice.sessions.open,
          PRACTICE_TARGET
        );
        const practiceState = yield* world.learner.query(
          practice.sessions.state,
          PRACTICE_TARGET
        );
        const firstQuestion = practiceState?.questions[0];
        assert.ok(firstQuestion, "Expected first practice question.");
        yield* world.learner.mutation(practice.sessions.check, {
          questionId: firstQuestion.questionId,
          response: ["option-2"],
        });

        // Advance two distinct releases so the initial snapshot leaves the active release's
        // baseSnapshotId slot and is protected solely by learner references until re-pinned.
        yield* world.release({ languages: ["id"], renamed: true });
        // Release a new compatible snapshot that adds English alongside Indonesian (new paper & placement versions).
        const next = yield* world.release({ languages: ["id", "en"] });
        expect(next.snapshotId).not.toBe(world.snapshotId);
        expect(
          yield* world.run(isSnapshotReferenced("assessment", world.snapshotId))
        ).toBe(true);

        const receipt = yield* world.internal.action(
          tryoutsInternal.mutations.repin.run,
          {
            batchSize: 1,
            fromSnapshotId: world.snapshotId,
          }
        );
        expect(receipt).toEqual({
          cursor: null,
          done: true,
          phase: "sessions",
          repinnedAttempts: 2,
          repinnedSessions: 1,
          skippedAttempts: 0,
          skippedSessions: 0,
          targetSnapshotId: next.snapshotId,
        });
        const inProgress = yield* Effect.promise(() =>
          world.t.query((ctx) => ctx.db.get("tryoutAttempts", activeAttemptId))
        );
        expect(inProgress?.assessmentSnapshotId).toBe(next.snapshotId);

        // Retired snapshot no longer holds any learner references.
        expect(
          yield* world.run(isSnapshotReferenced("assessment", world.snapshotId))
        ).toBe(false);

        const [attempt, placements, score, session, questions] =
          yield* Effect.promise(() =>
            world.t.query(async (ctx) =>
              Promise.all([
                ctx.db.get("tryoutAttempts", attemptId),
                ctx.db
                  .query("tryoutAttemptPlacements")
                  .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
                    query.eq("tryoutAttemptId", attemptId)
                  )
                  .collect(),
                ctx.db
                  .query("tryoutScores")
                  .withIndex("by_tryoutAttemptId", (query) =>
                    query.eq("tryoutAttemptId", attemptId)
                  )
                  .unique(),
                ctx.db.get("practiceSessions", sessionId),
                ctx.db
                  .query("practiceQuestions")
                  .withIndex(
                    "by_practiceSessionId_and_questionOrder",
                    (query) => query.eq("practiceSessionId", sessionId)
                  )
                  .collect(),
              ])
            )
          );
        expect(attempt?.assessmentSnapshotId).toBe(next.snapshotId);
        expect(score?.assessmentSnapshotId).toBe(next.snapshotId);
        expect(session?.assessmentSnapshotId).toBe(next.snapshotId);
        expect(
          Arr.every(placements, ({ versions }) => versions.length === 2)
        ).toBe(true);
        expect(
          Arr.every(questions, ({ versions }) => versions.length === 2)
        ).toBe(true);

        // Learner's existing practice answer remains intact and readable.
        const afterState = yield* world.learner.query(
          practice.sessions.state,
          PRACTICE_TARGET
        );
        expect(afterState?.questions[0]?.answer?.grade).toEqual({
          category: 1,
          ceiling: 1,
          status: "scored",
        });
      })
  );

  it.effect(
    "re-pins IRT attempts with a carried-over scale version and skips untouched placement versions",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({
          languages: ["id"],
          scoring: { kind: "irt" },
        });
        const { attemptId } = yield* world.start({ entry: false });
        yield* world.startSection(attemptId, "section-a");
        yield* world.answer(attemptId, {
          order: 1,
          pick: "correct",
          section: "section-a",
        });
        yield* world.completeSection(attemptId, "section-a");
        yield* world.startSection(attemptId, "section-b");
        yield* world.completeSection(attemptId, "section-b");

        const before = yield* Effect.promise(() =>
          world.t.query((ctx) => ctx.db.get("tryoutAttempts", attemptId))
        );
        assert.ok(before?.scaleVersionId, "Expected initial IRT scale.");

        // Release a new snapshot with identical item versions (renamed routes only) so placement versions are unchanged.
        const next = yield* world.release({
          languages: ["id"],
          renamed: true,
          scoring: { kind: "irt" },
        });
        const receipt = yield* world.internal.action(
          tryoutsInternal.mutations.repin.run,
          { fromSnapshotId: world.snapshotId }
        );
        expect(receipt.repinnedAttempts).toBe(1);
        expect(receipt.done).toBe(true);

        const [after, score] = yield* Effect.promise(() =>
          world.t.query(async (ctx) =>
            Promise.all([
              ctx.db.get("tryoutAttempts", attemptId),
              ctx.db
                .query("tryoutScores")
                .withIndex("by_tryoutAttemptId", (query) =>
                  query.eq("tryoutAttemptId", attemptId)
                )
                .unique(),
            ])
          )
        );
        expect(after?.assessmentSnapshotId).toBe(next.snapshotId);
        expect(after?.scaleVersionId).toBeDefined();
        expect(after?.scaleVersionId).not.toBe(before.scaleVersionId);
        expect(score?.scaleVersionId).toBe(after?.scaleVersionId);

        // Also covers practice session when versions are already identical.
        const world2 = yield* tryoutWorld({ languages: ["id"] });
        yield* world2.learner.mutation(practice.sessions.open, PRACTICE_TARGET);
        const next2 = yield* world2.release({
          languages: ["id"],
          renamed: true,
        });
        const receipt2 = yield* world2.internal.action(
          tryoutsInternal.mutations.repin.run,
          { fromSnapshotId: world2.snapshotId }
        );
        expect(receipt2.repinnedSessions).toBe(1);
        expect(receipt2.targetSnapshotId).toBe(next2.snapshotId);
      })
  );

  it.effect(
    "skips incompatible attempts and sessions without corrupting them and paginates past skipped rows",
    () =>
      Effect.gen(function* () {
        // 1. Scoring strategy changed (raw -> irt): attempt skipped, practice session still compatible.
        const scoringWorld = yield* tryoutWorld({
          languages: ["id"],
          scoring: { kind: "raw" },
        });
        const { attemptId: rawAttemptId } = yield* scoringWorld.start({
          entry: false,
        });
        yield* scoringWorld.learner.mutation(
          practice.sessions.open,
          PRACTICE_TARGET
        );
        yield* scoringWorld.release({
          languages: ["id"],
          scoring: { kind: "irt" },
        });
        const scoringReceipt = yield* scoringWorld.internal.action(
          tryoutsInternal.mutations.repin.run,
          { fromSnapshotId: scoringWorld.snapshotId }
        );
        expect(scoringReceipt.skippedAttempts).toBe(1);
        expect(scoringReceipt.repinnedSessions).toBe(1);
        const untouchedAttempt = yield* Effect.promise(() =>
          scoringWorld.t.query((ctx) =>
            ctx.db.get("tryoutAttempts", rawAttemptId)
          )
        );
        expect(untouchedAttempt?.assessmentSnapshotId).toBe(
          scoringWorld.snapshotId
        );

        // 2. Removed set / missing section / changed language / mutated interaction / multi-page cap.
        const multiWorld = yield* tryoutWorld({
          languages: ["id", "en"],
          sets: 2,
        });
        const { attemptId: set1Attempt } = yield* multiWorld.start({
          entry: false,
          setKey: "set-1",
        });
        const { attemptId: set2Attempt } = yield* multiWorld.start({
          entry: false,
          setKey: "set-2",
        });
        yield* multiWorld.learner.mutation(
          practice.sessions.open,
          PRACTICE_TARGET
        );
        yield* multiWorld.learner.mutation(practice.sessions.open, {
          ...PRACTICE_TARGET,
          setKey: "set-2",
        });

        // Mutate one placement's keyJson on set-1 attempt so it is incompatible,
        // and add a laterInteractions mismatch case via direct DB patch.
        yield* Effect.promise(() =>
          multiWorld.t.mutation(async (ctx) => {
            const firstPlacement = await ctx.db
              .query("tryoutAttemptPlacements")
              .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
                query.eq("tryoutAttemptId", set1Attempt)
              )
              .first();
            assert.ok(firstPlacement, "Expected placement to mutate.");
            await ctx.db.patch("tryoutAttemptPlacements", firstPlacement._id, {
              laterInteractions: [
                {
                  interactionJson: firstPlacement.interactionJson,
                  keyJson: firstPlacement.keyJson,
                  rule: firstPlacement.rule,
                },
              ],
            });
          })
        );

        // Release with only set-1 and only English (so set-2 disappears, and Indonesian practice session loses its language).
        yield* multiWorld.release({
          languages: ["en"],
          sets: 1,
        });

        // Capped run (maxPages = 1, batchSize = 1) stops early with done: false and a non-null cursor.
        const partial = yield* multiWorld.internal.action(
          tryoutsInternal.mutations.repin.run,
          {
            batchSize: 1,
            fromSnapshotId: multiWorld.snapshotId,
            maxPages: 1,
          }
        );
        expect(partial.done).toBe(false);
        expect(partial.phase).toBe("attempts");
        expect(partial.cursor).not.toBeNull();
        expect(partial.skippedAttempts).toBe(1);

        // Full run finishes every page across attempts and sessions without looping forever.
        const full = yield* multiWorld.internal.action(
          tryoutsInternal.mutations.repin.run,
          {
            batchSize: 1,
            fromSnapshotId: multiWorld.snapshotId,
          }
        );
        expect(full.done).toBe(true);
        expect(full.skippedAttempts).toBe(2);
        expect(full.skippedSessions).toBe(2);
        expect(set2Attempt).toBeDefined();
      })
  );

  it.effect(
    "caches set loads across multiple attempts, checks laterInteractions equality, and skips when IRT scale lookup fails",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({
          languages: ["id"],
          scoring: { kind: "irt" },
        });
        const { attemptId: firstId } = yield* world.start({ entry: false });
        yield* world.startSection(firstId, "section-a");
        yield* world.completeSection(firstId, "section-a");
        yield* world.startSection(firstId, "section-b");
        yield* world.completeSection(firstId, "section-b");
        const { attemptId: secondId } = yield* world.start({ entry: false });

        // Release a new IRT snapshot, then corrupt its duplicate IRT scale to trigger selectAttemptScale failure on one run.
        const next = yield* world.release({
          languages: ["id"],
          renamed: true,
          scoring: { kind: "irt" },
        });

        // Seed 2 duplicate scales for next.snapshotId so selectAttemptScale fails with TryoutStartError -> cleanly skipped.
        const dupIds = yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const first = await ctx.db.insert("irtScaleVersions", {
              assessmentSnapshotId: next.snapshotId,
              model: "2pl",
              publishedAt: TRYOUT_NOW,
              questionCount: 3,
              setIdentity: `${FIXTURE_TRACK.countryKey}/${FIXTURE_TRACK.examKey}/${FIXTURE_TRACK.trackKey}/set-1`,
              status: "provisional",
            });
            const second = await ctx.db.insert("irtScaleVersions", {
              assessmentSnapshotId: next.snapshotId,
              model: "2pl",
              publishedAt: TRYOUT_NOW + 1,
              questionCount: 3,
              setIdentity: `${FIXTURE_TRACK.countryKey}/${FIXTURE_TRACK.examKey}/${FIXTURE_TRACK.trackKey}/set-1`,
              status: "provisional",
            });
            return [first, second] as const;
          })
        );

        // Two attempts share one cached FrozenSet; both skip cleanly because of duplicate scale error.
        const skipped = yield* world.run(
          repinSnapshotPage({
            batchSize: Number.NaN,
            fromSnapshotId: world.snapshotId,
          })
        );
        expect(skipped.skippedAttempts).toBe(2);
        expect(skipped.phase).toBe("sessions");

        // Remove the duplicate scales and mutate one placement's interactionJson so one skips via sameStoredInteraction and the other succeeds.
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            await ctx.db.delete("irtScaleVersions", dupIds[0]);
            await ctx.db.delete("irtScaleVersions", dupIds[1]);
            const secondPlacement = await ctx.db
              .query("tryoutAttemptPlacements")
              .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
                query.eq("tryoutAttemptId", secondId)
              )
              .first();
            assert.ok(secondPlacement, "Expected second attempt placement.");
            await ctx.db.patch("tryoutAttemptPlacements", secondPlacement._id, {
              interactionJson: "{}",
            });
          })
        );

        const mixed = yield* world.internal.action(
          tryoutsInternal.mutations.repin.run,
          { fromSnapshotId: world.snapshotId }
        );
        expect(mixed.repinnedAttempts).toBe(1);
        expect(mixed.skippedAttempts).toBe(1);

        // Also cover direct-entry attempt with changed firstSectionKey (missing placement key) + laterInteractions identical check.
        const entryWorld = yield* tryoutWorld({ entry: true });
        yield* entryWorld.start({ entry: true });
        yield* entryWorld.release({
          entry: true,
          firstSectionKey: "section-z",
        });
        const entryReceipt = yield* entryWorld.internal.action(
          tryoutsInternal.mutations.repin.run,
          { fromSnapshotId: entryWorld.snapshotId }
        );
        expect(entryReceipt.skippedAttempts).toBe(1);
        expect(Option.isNone(Option.none())).toBe(true);
      })
  );
});
