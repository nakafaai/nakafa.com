import { describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { client } from "@repo/backend/test/client";
import {
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { Effect } from "effect";

const MARKS = { blank: 0, correct: 4, wrong: -1 };

/** Reads an attempt with its section attempts in order and its score. */
const readFinished = (world: TryoutWorld, attemptId: Id<"tryoutAttempts">) =>
  Effect.promise(() =>
    world.t.query(async (ctx) => ({
      attempt: await ctx.db.get("tryoutAttempts", attemptId),
      progress: await ctx.db.query("tryoutSetProgress").unique(),
      score: await ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (query) =>
          query.eq("tryoutAttemptId", attemptId)
        )
        .unique(),
      sections: await ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
          query.eq("tryoutAttemptId", attemptId)
        )
        .collect(),
    }))
  );

/**
 * Sits the fixture set: section A with its first question right and its second wrong, then section B
 * with its table right unless `blankTable`, completing each.
 */
const sitSet = (
  world: TryoutWorld,
  attemptId: Id<"tryoutAttempts">,
  blankTable = false
) =>
  Effect.gen(function* () {
    yield* world.startSection(attemptId, "section-a");
    yield* world.answer(attemptId, {
      order: 1,
      pick: "correct",
      section: "section-a",
    });
    yield* world.answer(attemptId, {
      order: 2,
      pick: "wrong",
      section: "section-a",
    });
    yield* world.completeSection(attemptId, "section-a");
    yield* world.startSection(attemptId, "section-b");
    if (!blankTable) {
      yield* world.answer(attemptId, {
        order: 1,
        pick: "correct",
        section: "section-b",
      });
    }
    return yield* world.completeSection(attemptId, "section-b");
  });

describe("tryouts/mutations/sections", () => {
  it.effect(
    "times one section at a time, resumes its timer, and scores a raw attempt once its last section ends",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        expect(yield* world.startSection(attemptId, "section-a")).toEqual({
          kind: "started",
        });
        expect(yield* world.startSection(attemptId, "section-a")).toEqual({
          kind: "started",
        });
        expect(
          yield* world.startSection(attemptId, "section-b").pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_SECTION_IN_PROGRESS" });
        const running = yield* readFinished(world, attemptId);
        expect(running.sections).toMatchObject([
          {
            expiresAt: TRYOUT_NOW + 600_000,
            sectionKey: "section-a",
            status: "in-progress",
            totalQuestions: 2,
          },
        ]);
        expect(yield* sitSet(world, attemptId)).toEqual({ kind: "completed" });
        const finished = yield* readFinished(world, attemptId);
        expect(finished.attempt).toMatchObject({
          completedSectionKeys: ["section-a", "section-b"],
          endReason: "submitted",
          scoreStatus: "official",
          status: "completed",
          totalCorrect: 2,
        });
        expect(finished.sections).toMatchObject([
          {
            answeredCount: 2,
            correctAnswers: 1,
            score: { publishedScore: 50, rawScore: 50, scoringStrategy: "raw" },
            status: "completed",
          },
          {
            answeredCount: 1,
            correctAnswers: 1,
            score: { publishedScore: 100, scoringStrategy: "raw" },
            status: "completed",
          },
        ]);
        expect(finished.score).toMatchObject({
          assessmentSnapshotId: world.snapshotId,
          publishedScore: 67,
          rawScore: 67,
          scoreStatus: "official",
          scoringStrategy: "raw",
          totalCorrect: 2,
          totalQuestions: 3,
        });
        expect(finished.progress).toMatchObject({
          publishedScore: 67,
          status: "completed",
        });
        expect(
          yield* world.startSection(attemptId, "section-a").pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_ATTEMPT_NOT_ACTIVE" });
      })
  );

  it.effect(
    "scores a penalized attempt by its marks: correct, wrong, and blank",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({
          scoring: { kind: "penalized", marks: MARKS },
        });
        const { attemptId } = yield* world.start();
        yield* sitSet(world, attemptId, true);
        expect((yield* readFinished(world, attemptId)).score).toMatchObject({
          publishedScore: 3,
          rawScore: 33,
          scoringStrategy: "penalized",
          totalCorrect: 1,
        });
      })
  );

  it.effect(
    "refuses to finish a composite attempt, whose formula the engine does not score",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({
          scoring: {
            formula: { de: "Summe", en: "Sum", id: "Jumlah" },
            kind: "composite",
          },
        });
        const { attemptId } = yield* world.start();
        yield* world.startSection(attemptId, "section-a");
        expect(
          yield* world.completeSection(attemptId, "section-a").pipe(Effect.flip)
        ).toMatchObject({
          _tag: "TryoutRuntimeError",
          code: "TRYOUT_SCORE_STRATEGY_UNSUPPORTED",
        });
      })
  );

  it.effect(
    "scores an IRT attempt against the provisional scale its start froze",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ scoring: { kind: "irt" } });
        const { attemptId } = yield* world.start();
        yield* sitSet(world, attemptId);
        const finished = yield* readFinished(world, attemptId);
        expect(finished.attempt).toMatchObject({
          scoreStatus: "provisional",
          status: "completed",
        });
        expect(finished.score).toMatchObject({
          rawScore: 67,
          scaleVersionId: finished.attempt?.scaleVersionId,
          scoreStatus: "provisional",
          scoringStrategy: "irt",
          theta: expect.any(Number),
          thetaSE: expect.any(Number),
          totalCorrect: 2,
        });
        expect(finished.sections[0]?.score).toMatchObject({
          scoringStrategy: "irt",
          theta: expect.any(Number),
        });
      })
  );

  it.effect(
    "ends a section whose timer ran out before the next one starts, and refuses it once finished",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        yield* world.startSection(attemptId, "section-a");
        vi.setSystemTime(TRYOUT_NOW + 600_000);
        expect(
          yield* world.startSection(attemptId, "section-a").pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_SECTION_NOT_ACTIVE" });
        yield* world.startSection(attemptId, "section-b");
        const rows = yield* readFinished(world, attemptId);
        expect(rows.sections).toMatchObject([
          {
            endReason: "time-expired",
            sectionKey: "section-a",
            status: "expired",
          },
          { sectionKey: "section-b", status: "in-progress" },
        ]);
        expect(
          yield* world.startSection(attemptId, "section-a").pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_SECTION_ALREADY_FINISHED" });
      })
  );

  it.effect(
    "refuses a section the attempt did not freeze, another learner's attempt, and a lapsed attempt",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        expect(
          yield* world.startSection(attemptId, "section-z").pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_SECTION_NOT_FOUND" });
        const other = yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, { now: TRYOUT_NOW, suffix: "other" })
          )
        );
        const otherLearner = client(
          world.t.withIdentity({
            sessionId: other.sessionId,
            subject: other.authUserId,
          })
        );
        for (const call of [
          tryouts.mutations.sections.start,
          tryouts.mutations.sections.complete,
        ]) {
          expect(
            yield* otherLearner
              .mutation(call, { attemptId, sectionKey: "section-a" })
              .pipe(Effect.flip)
          ).toMatchObject({ code: "TRYOUT_ATTEMPT_NOT_FOUND" });
        }
        vi.setSystemTime(TRYOUT_NOW + 3 * 86_400_000);
        expect(
          yield* world.startSection(attemptId, "section-a").pipe(Effect.flip)
        ).toMatchObject({ code: "TRYOUT_ATTEMPT_NOT_ACTIVE" });
        expect((yield* readFinished(world, attemptId)).sections).toEqual([]);
      })
  );
});
