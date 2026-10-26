import { describe, expect, it } from "@effect/vitest";
import {
  BLUEPRINT_PLAN,
  LoadPlan,
  scriptOf,
} from "@repo/backend/scripts/load/plan";
import { Array as Arr, Effect, Order, Random, Schema } from "effect";

/** A small plan of the blueprint's shape, which a test reads in full. */
const small = LoadPlan.make({ ...BLUEPRINT_PLAN, questions: 8, rooms: 3 });

describe("load plan", () => {
  it("holds the blueprint's parameters of the load test", () => {
    expect(Schema.decodeSync(LoadPlan)(BLUEPRINT_PLAN)).toMatchObject({
      disconnectShare: 0.05,
      proctors: 2,
      questions: 40,
      rooms: 50,
      secondTabShare: 0.1,
      students: 3000,
    });
    expect(() =>
      Schema.decodeSync(LoadPlan)({ ...BLUEPRINT_PLAN, students: 0 })
    ).toThrow();
  });

  it.effect(
    "answers every question once in its own slot, in time order, and changes only earlier ones",
    () =>
      Effect.gen(function* () {
        const plan = LoadPlan.make({ ...small, changeShare: 1 });
        const script = yield* scriptOf(plan, 4);
        const slot = (plan.minutes * 60_000) / plan.questions;
        const ats = Arr.map(script.steps, (step) => step.at);
        expect(ats).toEqual(Arr.sort(ats, Order.Number));
        expect(
          Arr.dedupe(Arr.map(script.steps, (step) => step.question))
        ).toHaveLength(plan.questions);
        // Every question but the first draws one change of an earlier question.
        expect(script.steps).toHaveLength(plan.questions * 2 - 1);
        const firsts = Arr.filter(script.steps, (step, index) =>
          Arr.every(
            Arr.take(script.steps, index),
            (earlier) => earlier.question !== step.question
          )
        );
        expect(
          Arr.every(
            firsts,
            (step) =>
              step.at >= step.question * slot &&
              step.at < (step.question + 1) * slot
          )
        ).toBe(true);
        expect(script.room).toBe(1);
        expect(script.index).toBe(4);
      }).pipe(Random.withSeed("plan"))
  );

  it.effect("draws no change, cut, or second tab at a share of none", () =>
    Effect.gen(function* () {
      const plan = LoadPlan.make({
        ...small,
        changeShare: 0,
        disconnectShare: 0,
        secondTabShare: 0,
      });
      const script = yield* scriptOf(plan, 0);
      expect(script.steps).toHaveLength(plan.questions);
      expect(script.cut).toBeNull();
      expect(script.secondTab).toBe(false);
      expect(script.enterAt).toBeLessThanOrEqual(plan.entrySeconds * 1000);
    }).pipe(Random.withSeed("none"))
  );

  it.effect(
    "cuts a student once in the middle half of the paper, for the plan's time, at a share of all",
    () =>
      Effect.gen(function* () {
        const plan = LoadPlan.make({
          ...small,
          changeShare: 0,
          disconnectShare: 1,
          secondTabShare: 1,
        });
        const script = yield* scriptOf(plan, 2);
        expect(script.cut).not.toBeNull();
        expect(script.cut?.lasts).toBe(plan.offlineSeconds * 1000);
        expect(script.cut?.afterStep).toBeGreaterThanOrEqual(2);
        expect(script.cut?.afterStep).toBeLessThanOrEqual(6);
        expect(script.secondTab).toBe(true);
      }).pipe(Random.withSeed("cut"))
  );
});
