import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  seedTryoutGate,
  type TryoutGateWorld,
} from "@repo/backend/test/tryout/gate";
import { Array as Arr, Effect, Option } from "effect";

/** Reads the running question as the learner's section state shows it. */
const readQuestion = (world: TryoutGateWorld) =>
  world.learner
    .query(tryouts.queries.runtime.getSectionAttemptState, {
      attemptId: world.attemptId,
      locale: "id",
      sectionKey: "section-a",
    })
    .pipe(
      Effect.map((state) =>
        Option.getOrUndefined(Arr.head(state?.runtime?.questions ?? []))
      )
    );

/** Reads the stored answers and the running section's counters. */
const readStored = (world: TryoutGateWorld) =>
  Effect.promise(() =>
    world.t.query(async (ctx) => ({
      responses: await ctx.db.query("tryoutResponses").collect(),
      section: await ctx.db.get(
        "tryoutSectionAttempts",
        world.sectionAttemptId
      ),
    }))
  );

describe("tryouts/mutations/responses", () => {
  it.effect(
    "counts an unmatched typed answer as answered while it awaits the grader, and a matched one as correct",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        yield* world.answer("learner", "running", "pending", 1);
        const pending = yield* readStored(world);
        expect(pending.responses).toMatchObject([
          {
            grade: { ceiling: 1, status: "pending" },
            response: { text: "Bandung" },
          },
        ]);
        expect(pending.section).toMatchObject({
          answeredCount: 1,
          correctAnswers: 0,
        });
        yield* world.learner.mutation(tryouts.mutations.responses.save, {
          placementId: world.placementId,
          response: { text: " jakarta" },
          version: 2,
        });
        const matched = yield* readStored(world);
        expect(matched.responses).toMatchObject([
          {
            grade: { category: 1, ceiling: 1, status: "scored" },
            response: { text: " jakarta" },
          },
        ]);
        expect(matched.section).toMatchObject({
          answeredCount: 1,
          correctAnswers: 1,
        });
      })
  );

  it.effect(
    "keeps an empty choice as the latest write, which leaves the question unanswered",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        yield* world.answer("learner", "running", "incorrect", 1);
        yield* world.learner.mutation(tryouts.mutations.responses.save, {
          placementId: world.placementId,
          response: [],
          version: 2,
        });
        const stored = yield* readStored(world);
        expect(stored.responses).toMatchObject([{ response: [], version: 2 }]);
        expect(stored.section).toMatchObject({
          answeredCount: 0,
          correctAnswers: 0,
        });
      })
  );

  it.effect(
    "returns the version of the question's latest write without its grade, which a clear keeps and the next write must exceed",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        expect(yield* readQuestion(world)).toMatchObject({ response: null });
        expect((yield* readQuestion(world))?.version).toBeUndefined();
        yield* world.answer("learner", "running", "incorrect", 4);
        const answered = yield* readQuestion(world);
        expect(answered).toMatchObject({
          response: { response: ["option-1"] },
          version: 4,
        });
        // A running section never tells the learner how an answer grades.
        expect(answered?.response).not.toHaveProperty("grade");
        yield* world.answer("learner", "running", "clear", 5);
        expect(yield* readQuestion(world)).toMatchObject({
          response: null,
          version: 5,
        });
      })
  );

  it.effect.each([0, -1, 1.5])(
    "refuses a version that is not a positive whole number (%s) at the argument validator",
    (version) =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        const rejected = yield* Effect.tryPromise(() =>
          world.learnerConvex.mutation(
            Ref.getFunctionReference(tryouts.mutations.responses.save),
            { placementId: world.placementId, response: ["option-2"], version }
          )
        ).pipe(Effect.asVoid, Effect.flip);
        expect(String(rejected.cause)).toContain('at ["version"]');
        expect((yield* readStored(world)).responses).toEqual([]);
      })
  );

  it.effect(
    "refuses an answer without a version at the argument validator, before any write",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        const refusal = yield* Effect.tryPromise(() =>
          world.learnerConvex.mutation(
            Ref.getFunctionReference(tryouts.mutations.responses.save),
            { placementId: world.placementId, response: ["option-2"] }
          )
        ).pipe(
          Effect.match({
            onFailure: ({ cause }) => String(cause),
            onSuccess: () => "accepted",
          })
        );
        expect(refusal).toContain("Missing required field `version`");
        expect((yield* readStored(world)).responses).toEqual([]);
      })
  );
});
