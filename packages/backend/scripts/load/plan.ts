import { Array as Arr, Effect, Order, Random, Schema } from "effect";

/** A share of the students, from none to all. */
const Share = Schema.Finite.check(Schema.isBetween({ maximum: 1, minimum: 0 }));

/** A whole count of one or more. */
const Count = Schema.Int.check(Schema.isGreaterThan(0));

/**
 * The parameters of one load test run (K26). The students sit one exam of `questions`
 * questions in `rooms` rooms at once, each room watched by `proctors` proctors. They enter
 * within `entrySeconds`, answer at the pace of `minutes` for the whole paper, change a share
 * of their answers later, and a share of them lose the connection once for `offlineSeconds`
 * or open a second tab.
 */
export const LoadPlan = Schema.Struct({
  changeShare: Share,
  disconnectShare: Share,
  entrySeconds: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  minutes: Schema.Finite.check(Schema.isGreaterThan(0)),
  offlineSeconds: Schema.Finite.check(Schema.isGreaterThan(0)),
  proctors: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  questions: Count,
  rooms: Count,
  secondTabShare: Share,
  students: Count,
});
export type LoadPlan = typeof LoadPlan.Type;

/**
 * The blueprint's load test (Mutu, K26): 3,000 students of one school in fifty rooms of sixty,
 * two proctors a room, a paper of forty questions, five percent of the students cut off once
 * mid-session and ten percent with a second tab. The paper is answered in twenty minutes, four
 * and a half times the pace of a ninety-minute exam, so the run is a stress of the real rate.
 */
export const BLUEPRINT_PLAN = LoadPlan.make({
  changeShare: 0.1,
  disconnectShare: 0.05,
  entrySeconds: 60,
  minutes: 20,
  offlineSeconds: 20,
  proctors: 2,
  questions: 40,
  rooms: 50,
  secondTabShare: 0.1,
  students: 3000,
});

/** One write that a student makes: the question, by its index, and when, in milliseconds after entry. */
export const Step = Schema.Struct({
  at: Schema.Finite,
  question: Schema.Int,
});
export type Step = typeof Step.Type;

/** A student's one cut: after which step the connection drops, and for how long. */
const Cut = Schema.Struct({
  afterStep: Schema.Int,
  lasts: Schema.Finite,
});

/**
 * What one student does in a run: the room, by its index, when the student enters, in
 * milliseconds after the start, every answer in time order, the cut if the student has one,
 * and whether the student opens a second tab.
 */
export const StudentScript = Schema.Struct({
  cut: Schema.NullOr(Cut),
  enterAt: Schema.Finite,
  index: Schema.Int,
  room: Schema.Int,
  secondTab: Schema.Boolean,
  steps: Schema.Array(Step),
});
export type StudentScript = typeof StudentScript.Type;

/** Whether a draw from zero to one falls within a share. */
const drawn = (share: number) =>
  Effect.map(Random.next, (value) => value < share);

/**
 * The answers of one student: one for each question in order, each at a random time within
 * its own slot of the paper's pace, and with the plan's share a change of an earlier
 * question soon after, so a later version replaces a saved answer.
 */
const stepsOf = Effect.fn("load.plan.steps")(function* (plan: LoadPlan) {
  const slot = (plan.minutes * 60_000) / plan.questions;
  const steps = yield* Effect.forEach(
    Arr.makeBy(plan.questions, (question) => question),
    Effect.fn(function* (question) {
      const at = question * slot + (yield* Random.nextBetween(0, slot));
      const answer: Step = { at, question };
      if (question === 0 || !(yield* drawn(plan.changeShare))) {
        return [answer];
      }
      const changed: Step = {
        at: at + (yield* Random.nextBetween(0, slot / 2)),
        question: yield* Random.nextIntBetween(0, question - 1),
      };
      return [answer, changed];
    })
  );
  return Arr.sort(
    Arr.flatten(steps),
    Order.mapInput(Order.Number, (step: Step) => step.at)
  );
});

/**
 * The script of the student with this index. Students fill the rooms in turn, so every room
 * holds the same number, give or take one. The draws come from `Random`, so a seeded run
 * repeats its scripts.
 */
export const scriptOf = Effect.fn("load.plan.script")(function* (
  plan: LoadPlan,
  index: number
) {
  const steps = yield* stepsOf(plan);
  const cut = (yield* drawn(plan.disconnectShare))
    ? {
        afterStep: yield* Random.nextIntBetween(
          Math.floor(steps.length / 4),
          Math.floor((steps.length * 3) / 4)
        ),
        lasts: plan.offlineSeconds * 1000,
      }
    : null;
  return {
    cut,
    enterAt: yield* Random.nextBetween(0, plan.entrySeconds * 1000),
    index,
    room: index % plan.rooms,
    secondTab: yield* drawn(plan.secondTabShare),
    steps,
  } satisfies StudentScript;
});
