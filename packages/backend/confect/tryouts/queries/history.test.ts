import { Ref } from "@confect/core";
import { assert, describe, expect, it } from "@effect/vitest";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { homeOrder } from "@repo/backend/confect/tryouts/queries/history";
import {
  FIXTURE_TRACK,
  fixtureSetPath,
} from "@repo/backend/test/assessment/catalog";
import type { TryoutWorld } from "@repo/backend/test/tryout/world";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Struct } from "effect";

const identity = { ...FIXTURE_TRACK, locale: "id" as const, setKey: "set-1" };

/**
 * Turns the learner's started attempt into `count` finished attempts of the set, each with a raw
 * score equal to its number, started one millisecond apart.
 */
const seedHistory = (world: TryoutWorld, count: number) =>
  Effect.gen(function* () {
    const { attemptId } = yield* world.start();
    return yield* Effect.promise(() =>
      world.t.mutation(async (ctx) => {
        const template = await ctx.db.get("tryoutAttempts", attemptId);
        assert.ok(template, "Expected the started attempt.");
        await ctx.db.delete("tryoutAttempts", attemptId);
        return Promise.all(
          Arr.map(Arr.range(1, count), async (attemptNumber) => {
            const startedAt = TRYOUT_NOW + attemptNumber;
            const id = await ctx.db.insert("tryoutAttempts", {
              ...Struct.omit(template, ["_creationTime", "_id"]),
              attemptNumber,
              completedAt: startedAt + 1000,
              endReason: "submitted",
              startedAt,
              status: "completed",
            });
            await ctx.db.insert("tryoutScores", {
              assessmentSnapshotId: template.assessmentSnapshotId,
              finalizedAt: startedAt + 1000,
              publishedScore: attemptNumber,
              rawScore: attemptNumber,
              scoreStatus: "official",
              scoringStrategy: "raw",
              setIdentity: template.setIdentity,
              totalCorrect: 0,
              totalQuestions: template.totalQuestions,
              tryoutAttemptId: id,
              userId: template.userId,
            });
            return id;
          })
        );
      })
    );
  });

describe("homeOrder", () => {
  const attempt = (
    status: Docs["tryoutAttempts"]["status"],
    expiresAt: number
  ) => ({ expiresAt, status });

  it("puts every running set first, the one whose time ends soonest on top, then the rest as they came", () => {
    const done = attempt("completed", 1);
    const late = attempt("in-progress", 900);
    const gone = attempt("expired", 2);
    const soon = attempt("in-progress", 300);
    expect(homeOrder([done, late, gone, soon])).toEqual([
      soon,
      late,
      done,
      gone,
    ]);
  });
});

describe("tryouts/queries/history", () => {
  it.effect(
    "lists a set's attempts newest first with their scores, after a later release renames its route",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const [first, second] = yield* seedHistory(world, 2);
        yield* world.release({ renamed: true });
        const history = yield* world.learner.query(
          tryouts.queries.history.bySet,
          { ...identity, paginationOpts: { cursor: null, numItems: 25 } }
        );
        expect(history.isDone).toBe(true);
        expect(history.page).toEqual([
          expect.objectContaining({
            attemptId: second,
            attemptNumber: 2,
            score: expect.objectContaining({ publishedScore: 2 }),
            status: "completed",
          }),
          expect.objectContaining({
            attemptId: first,
            attemptNumber: 1,
            score: expect.objectContaining({ publishedScore: 1 }),
            status: "completed",
          }),
        ]);
      })
  );

  it.effect(
    "keeps another set's history apart, and reads at most twenty-five attempts a page",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        yield* seedHistory(world, 26);
        expect(
          yield* world.learner.query(tryouts.queries.history.bySet, {
            ...identity,
            paginationOpts: { cursor: null, numItems: 25 },
            setKey: "missing",
          })
        ).toMatchObject({ isDone: true, page: [] });
        const page = yield* world.learner.query(tryouts.queries.history.bySet, {
          ...identity,
          paginationOpts: { cursor: null, numItems: 100 },
        });
        expect(page.isDone).toBe(false);
        expect(page.page).toHaveLength(25);
        expect(page.page[0]?.attemptNumber).toBe(26);
      })
  );

  it.effect("refuses malformed set keys", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      for (const setKey of ["Set-1", "set\0one", "s".repeat(129)]) {
        const refused = yield* Effect.tryPromise(() =>
          world.learnerConvex.query(
            Ref.getFunctionReference(tryouts.queries.history.bySet),
            {
              ...identity,
              paginationOpts: { cursor: null, numItems: 25 },
              setKey,
            }
          )
        ).pipe(Effect.asVoid, Effect.flip);
        expect(refused.cause).toMatchObject({
          data: { code: "TRYOUT_ROUTE_INVALID" },
        });
      }
    })
  );

  it.effect(
    "lists the sets sat last, newest first and one row a set, by the route of the active release",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ sets: 2 });
        const [, last] = yield* seedHistory(world, 2);
        vi.setSystemTime(TRYOUT_NOW + 60_000);
        const running = yield* world.start({ setKey: "set-2" });
        // The learner is three answers into the set's first part.
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            const attempt = await ctx.db.get(
              "tryoutAttempts",
              running.attemptId
            );
            assert.ok(attempt, "Expected the running attempt.");
            const [first] = attempt.sections;
            assert.ok(first, "Expected the set's first part.");
            const [language] = first.languages;
            assert.ok(language, "Expected the part's first language.");
            await ctx.db.insert("tryoutSectionAttempts", {
              answeredCount: 3,
              completedAt: null,
              correctAnswers: 0,
              endReason: null,
              expiresAt: attempt.expiresAt,
              lastActivityAt: TRYOUT_NOW + 60_000,
              questionLanguage: language,
              sectionKey: first.sectionKey,
              sectionOrder: first.sectionOrder,
              startedAt: TRYOUT_NOW + 60_000,
              status: "in-progress",
              totalQuestions: first.questionCount,
              tryoutAttemptId: running.attemptId,
            });
          })
        );
        yield* world.release({ renamed: true, sets: 2 });
        const recent = yield* world.learner.query(
          tryouts.queries.history.recent,
          { locale: "id" }
        );
        expect(recent).toEqual([
          {
            answered: 3,
            attemptId: running.attemptId,
            correct: 0,
            countryCode: expect.any(String),
            examKey: FIXTURE_TRACK.examKey,
            expiresAt: expect.any(Number),
            locale: "id",
            part: { key: expect.any(String), title: expect.any(String) },
            publicPath: fixtureSetPath("set-2", "id", true),
            questions: expect.any(Number),
            score: null,
            startedAt: TRYOUT_NOW + 60_000,
            status: "in-progress",
            title: expect.any(String),
            track: expect.any(String),
          },
          expect.objectContaining({
            attemptId: last,
            locale: "id",
            part: null,
            publicPath: fixtureSetPath("set-1", "id", true),
            score: 2,
            status: "completed",
          }),
        ]);

        // Viewing home in English resolves the English localized route for attempts started in Indonesian.
        const inEnglish = yield* world.learner.query(
          tryouts.queries.history.recent,
          { locale: "en" }
        );
        expect(inEnglish).toEqual([
          expect.objectContaining({
            attemptId: running.attemptId,
            locale: "en",
            publicPath: fixtureSetPath("set-2", "en", true),
          }),
          expect.objectContaining({
            attemptId: last,
            locale: "en",
            publicPath: fixtureSetPath("set-1", "en", true),
          }),
        ]);

        // Viewing home in a locale where the set is not published falls back to the attempt's own locale.
        const inMalay = yield* world.learner.query(
          tryouts.queries.history.recent,
          { locale: "ms" }
        );
        expect(inMalay).toEqual([
          expect.objectContaining({
            attemptId: running.attemptId,
            locale: "id",
            publicPath: fixtureSetPath("set-2", "id", true),
          }),
          expect.objectContaining({
            attemptId: last,
            locale: "id",
            publicPath: fixtureSetPath("set-1", "id", true),
          }),
        ]);
      })
  );

  it.effect(
    "leaves out a set the active release no longer publishes, and refuses a visitor",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { attemptId } = yield* world.start();
        yield* Effect.promise(() =>
          world.t.mutation(async (ctx) => {
            await ctx.db.patch("tryoutAttempts", attemptId, {
              setIdentity: "indonesia/snbt/utbk/retired",
            });
          })
        );
        expect(
          yield* world.learner.query(tryouts.queries.history.recent, {
            locale: "id",
          })
        ).toEqual([]);
        expect(
          yield* world.learner.query(tryouts.queries.history.recent, {
            locale: "en",
          })
        ).toEqual([]);
        expect(
          (yield* world.visitor
            .query(tryouts.queries.history.recent, { locale: "id" })
            .pipe(Effect.flip))._tag
        ).toBe("SessionRequired");
      })
  );
});
