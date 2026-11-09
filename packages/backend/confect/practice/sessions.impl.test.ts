import { describe, expect, it } from "@effect/vitest";
import practice from "@repo/backend/confect/_generated/refs/practice";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import { FIXTURE_TRACK } from "@repo/backend/test/assessment/snapshot";
import { client } from "@repo/backend/test/client";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect } from "effect";

const { check, content, explain, open, restart, state } = practice.sessions;

/** The first section of the fixture's set 1, read in Indonesian. */
const TARGET = {
  ...FIXTURE_TRACK,
  locale: "id",
  sectionKey: "section-a",
  setKey: "set-1",
} as const;

/** The key and a wrong answer of the section's first question, a single choice. */
const FIRST = { correct: ["option-2"], wrong: ["option-1"] } as const;

/**
 * Opens the learner's practice of the section and reads its two questions' IDs. The fixture's section holds
 * two questions, a single choice and a multiple choice.
 */
const openPractice = Effect.fn("test.practice.open")(function* (
  world: Effect.Success<ReturnType<typeof tryoutWorld>>
) {
  const { sessionId } = yield* world.learner.mutation(open, TARGET);
  const opened = yield* world.learner.query(state, TARGET);
  const questions = opened?.questions ?? [];
  const [one, two] = yield* Effect.all([
    Effect.fromOption(Arr.get(questions, 0)),
    Effect.fromOption(Arr.get(questions, 1)),
  ]);
  return { one: one.questionId, questions, sessionId, two: two.questionId };
});

describe("practice/sessions", () => {
  it.effect(
    "opens one session per section with its questions frozen in order, and opens the same one again",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        expect(yield* world.learner.query(state, TARGET)).toBeNull();
        const first = yield* openPractice(world);
        expect(
          Arr.map(first.questions, ({ answer, questionOrder }) => ({
            answer,
            questionOrder,
          }))
        ).toEqual([
          { answer: null, questionOrder: 1 },
          { answer: null, questionOrder: 2 },
        ]);
        const again = yield* world.learner.mutation(open, TARGET);
        expect(again.sessionId).toBe(first.sessionId);
      })
  );

  it.effect(
    "checks a question once with its verdict, keeps the answer, and refuses a second check",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { one, two } = yield* openPractice(world);
        expect(
          yield* world.learner.mutation(check, {
            questionId: one,
            response: [...FIRST.correct],
          })
        ).toEqual({ verdict: "correct" });
        expect(
          yield* world.learner.mutation(check, {
            questionId: two,
            response: ["option-2"],
          })
        ).toEqual({ verdict: "incorrect" });
        const failure = yield* world.learner
          .mutation(check, { questionId: one, response: [...FIRST.wrong] })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ code: "PRACTICE_CHECKED" });
        const checked = yield* world.learner.query(state, TARGET);
        expect(
          Arr.map(checked?.questions ?? [], ({ answer }) => answer?.response)
        ).toEqual([[...FIRST.correct], ["option-2"]]);
      })
  );

  it.effect(
    "sends bodies without keys, and a checked question's key and explanation only to Pro or on a free sample",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const { one, questions, sessionId, two } = yield* openPractice(world);
        const bodies = yield* world.learner.query(content, {
          locale: "id",
          sessionId,
        });
        expect(bodies).toHaveLength(questions.length);
        expect(Arr.some(bodies, ({ body }) => body.includes('"key"'))).toBe(
          false
        );
        // A question is explained only once it is checked.
        expect(
          yield* world.learner.query(explain, { locale: "id", questionId: one })
        ).toBeNull();
        yield* world.learner.mutation(check, {
          questionId: one,
          response: [...FIRST.correct],
        });
        expect(
          yield* world.learner.query(explain, { locale: "id", questionId: one })
        ).toMatchObject({ key: { kind: "choice" } });
        // Past the two free samples a free learner reads no key; a Pro learner does.
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.patch("practiceQuestions", two, { questionOrder: 3 })
          )
        );
        yield* world.learner.mutation(check, {
          questionId: two,
          response: ["option-2"],
        });
        expect(
          yield* world.learner.query(explain, { locale: "id", questionId: two })
        ).toBeNull();
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.patch("users", world.userId, { plan: "pro" })
          )
        );
        expect(
          yield* world.learner.query(explain, { locale: "id", questionId: two })
        ).toMatchObject({ key: { kind: "choice" } });
      })
  );

  it.effect("starts again with every answer gone", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      const { one, sessionId } = yield* openPractice(world);
      yield* world.learner.mutation(check, {
        questionId: one,
        response: [...FIRST.correct],
      });
      expect(yield* world.learner.mutation(restart, { sessionId })).toEqual({
        sessionId,
      });
      const restarted = yield* world.learner.query(state, TARGET);
      expect(
        Arr.map(restarted?.questions ?? [], ({ answer }) => answer)
      ).toEqual([null, null]);
    })
  );

  it.effect("refuses another learner's session and question", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      const { one, sessionId } = yield* openPractice(world);
      const other = yield* Effect.promise(() =>
        world.t.mutation((ctx) =>
          seedAuthenticatedUser(ctx, { now: TRYOUT_NOW, suffix: "other" })
        )
      );
      const outsider = client(
        world.t.withIdentity({
          sessionId: other.sessionId,
          subject: other.authUserId,
        })
      );
      expect(yield* outsider.query(state, TARGET)).toBeNull();
      expect(
        yield* outsider.mutation(restart, { sessionId }).pipe(Effect.flip)
      ).toMatchObject({ code: "PRACTICE_MISSING" });
      expect(
        yield* outsider
          .mutation(check, { questionId: one, response: [...FIRST.correct] })
          .pipe(Effect.flip)
      ).toMatchObject({ code: "PRACTICE_MISSING" });
      expect(
        yield* outsider
          .query(content, { locale: "id", sessionId })
          .pipe(Effect.flip)
      ).toMatchObject({ code: "PRACTICE_MISSING" });
    })
  );
});
