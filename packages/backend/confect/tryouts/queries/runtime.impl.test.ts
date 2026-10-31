import { assert, describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import { client } from "@repo/backend/test/client";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Struct } from "effect";

const { getSectionAttemptState, getSetAttemptState } = tryouts.queries.runtime;

describe("tryouts/queries/runtime", () => {
  it.effect(
    "reports each question's flag from the shared flags table, and only the attempt's own",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        yield* world.startSection(attemptId, "section-a");
        const flagged = yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const placement = await ctx.db
              .query("tryoutAttemptPlacements")
              .withIndex(
                "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
                (query) =>
                  query
                    .eq("tryoutAttemptId", attemptId)
                    .eq("sectionKey", "section-a")
              )
              .first();
            assert.ok(placement);
            await ctx.db.insert("assessmentFlags", {
              attempt: attemptId,
              kind: "tryout",
              question: placement._id,
            });
            await ctx.db.insert("assessmentFlags", {
              attempt: "another-attempt",
              kind: "tryout",
              question: "another-question",
            });
            return placement._id;
          })
        );
        const state = yield* world.learner.query(getSectionAttemptState, {
          attemptId,
          locale: "id",
          sectionKey: "section-a",
        });
        expect(
          Arr.map(
            state?.runtime?.questions ?? [],
            ({ flagged: isFlagged, placementId }) => [
              placementId === flagged,
              isFlagged,
            ]
          )
        ).toEqual([
          [true, true],
          [false, false],
        ]);
      })
  );

  it.effect(
    "keeps the live state of a direct-entry attempt compact, without a score while it runs",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ entry: true });
        const { attemptId } = yield* world.start({ entry: true });
        const state = yield* world.learner.query(getSetAttemptState, {
          attemptId,
          locale: "id",
        });
        expect(state).toMatchObject({
          attempt: {
            activeSectionKey: "section-a",
            attemptId,
            resumeSectionKey: "section-a",
            score: null,
          },
          runtime: {
            questions: [{ questionOrder: 1 }, { questionOrder: 2 }],
            section: { sectionKey: "section-a", status: "in-progress" },
          },
        });
        expect(state?.attempt).not.toHaveProperty("totalQuestions");
      })
  );

  it.effect(
    "binds section state to the attempt's owner and its frozen sections, whatever the active release holds",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        const args = {
          attemptId,
          locale: "id" as const,
          sectionKey: "section-a",
        };
        expect(
          yield* world.learner.query(getSectionAttemptState, args)
        ).toMatchObject({ attempt: { section: null }, runtime: null });
        expect(
          yield* world.learner.query(getSectionAttemptState, {
            ...args,
            sectionKey: "section-z",
          })
        ).toBeNull();
        const other = yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            seedAuthenticatedUser(ctx, { now: TRYOUT_NOW, suffix: "outsider" })
          )
        );
        const outsider = client(
          world.t.withIdentity({
            sessionId: other.sessionId,
            subject: other.authUserId,
          })
        );
        for (const caller of [world.visitor, outsider]) {
          expect(
            yield* caller.query(getSetAttemptState, { attemptId, locale: "id" })
          ).toBeNull();
          expect(yield* caller.query(getSectionAttemptState, args)).toBeNull();
        }
        yield* world.startSection(attemptId, "section-a");
        const initial = yield* world.learner.query(
          getSectionAttemptState,
          args
        );
        expect(initial).toMatchObject({
          attempt: { attemptId, section: { sectionKey: "section-a" } },
          runtime: { questions: [{ response: null }, { response: null }] },
        });
        yield* world.release({ renamed: true, sets: 2 });
        expect(
          yield* world.learner.query(getSectionAttemptState, args)
        ).toEqual(initial);
        yield* world.completeSection(attemptId, "section-a");
        // A finished section of a running attempt shows no questions until the attempt ends.
        expect(
          yield* world.learner.query(getSectionAttemptState, args)
        ).toMatchObject({
          attempt: { section: { status: "completed" } },
          runtime: null,
        });
      })
  );

  it.effect("refuses section attempts beyond the frozen sections", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      const { attemptId } = yield* world.start();
      yield* world.startSection(attemptId, "section-a");
      yield* Effect.promise(() =>
        world.t.mutation(async (ctx) => {
          const section = await ctx.db
            .query("tryoutSectionAttempts")
            .withIndex("by_tryoutAttemptId_and_sectionKey", (query) =>
              query
                .eq("tryoutAttemptId", attemptId)
                .eq("sectionKey", "section-a")
            )
            .unique();
          assert.ok(section);
          for (const sectionKey of ["section-y", "section-z"]) {
            await ctx.db.insert("tryoutSectionAttempts", {
              ...Struct.omit(section, ["_creationTime", "_id"]),
              sectionKey,
            });
          }
        })
      );
      expect(
        yield* world.learner
          .query(getSetAttemptState, { attemptId, locale: "id" })
          .pipe(Effect.flip)
      ).toMatchObject({ code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED" });
    })
  );
});
