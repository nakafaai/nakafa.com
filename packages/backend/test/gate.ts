import { describe, expect, it } from "@effect/vitest";
import type { AttemptRefused } from "@repo/backend/confect/assessment/gate/refusal";
import type { ResponseRejected } from "@repo/backend/confect/response/model";
import { endings, refusals, rejections } from "@repo/backend/test/gate/cases";
import {
  type Caller,
  type Change,
  type Failure,
  Observed,
  type Pick,
  type Target,
} from "@repo/backend/test/gate/world";
import { Effect, Match, Option } from "effect";

/** A write the gate admits. */
/** The writes that the shared gate cases run: an answer and a finish. */
type Write = "answer" | "finish";
const WRITES: readonly Write[] = ["answer", "finish"];

/** A reason a refusal names. */
type Reason = AttemptRefused["reason"]["_tag"];

/** What the fixture observes while the section still runs. */
const running = (
  answered: number,
  correct: number,
  outcome: Observed["outcome"],
  version: Observed["version"]
) => Observed.make({ answered, correct, outcome, section: "running", version });

/**
 * The live-attempt gate's contract, run by every attempt store through its
 * real public functions, so each case crosses the gate and the store's wire
 * mapping together. A fixture seeds a learner, another learner, and one
 * attempt with a running section and a section not yet started, each with a
 * question, and states the errors its functions declare for each refusal.
 */
export function describeGate<
  W extends {
    readonly answer: (
      caller: Caller,
      target: Target,
      pick: Pick,
      version: number
    ) => Effect.Effect<Option.Option<Failure>>;
    readonly finish: (
      caller: Caller,
      target: Target
    ) => Effect.Effect<Option.Option<Failure>>;
    readonly arrange: (change: Change) => Effect.Effect<void>;
    readonly observe: Effect.Effect<Observed>;
    /** Every row a write may touch, compared before and after a refusal. */
    readonly rows: Effect.Effect<unknown>;
  },
>(
  name: string,
  fixture: {
    readonly seed: Effect.Effect<W>;
    readonly refusal: (write: Write, reason: Reason) => Failure;
    readonly rejection: (reason: ResponseRejected["reason"]) => Failure;
    /** The failure an answer whose version is not newer than the question's latest write declares. */
    readonly stale: Failure;
    /** The failure a store failure masks to, cause kept, for each write. */
    readonly masked: (write: Write) => Failure;
    /** Rows the store's own integrity checks reject, each failing closed with its code. */
    readonly corruptions: readonly {
      readonly name: string;
      readonly write: Write;
      readonly arrange: (world: W) => Effect.Effect<void>;
      readonly failure: Failure;
    }[];
  }
) {
  /** Runs one refused write and proves it wrote nothing. */
  const refused = Effect.fn("test.gate.refused")(function* (
    world: W,
    write: Effect.Effect<Option.Option<Failure>>,
    failure: Failure
  ) {
    const before = yield* world.rows;
    expect(yield* write).toEqual(Option.some(failure));
    expect(yield* world.rows).toEqual(before);
  });
  /** Runs one write of each kind on a target, answering with the question's key. */
  const write = (world: W, kind: Write, caller: Caller, target: Target) =>
    Match.value(kind).pipe(
      Match.when("answer", () => world.answer(caller, target, "correct", 1)),
      Match.when("finish", () => world.finish(caller, target)),
      Match.exhaustive
    );

  describe(`${name} through the live-attempt gate`, () => {
    it.effect(
      "saves, replaces, and clears an answer with exact counters and its version",
      () =>
        Effect.gen(function* () {
          const world = yield* fixture.seed;
          expect(
            yield* world.answer("learner", "running", "correct", 1)
          ).toEqual(Option.none());
          expect(yield* world.observe).toEqual(
            running(1, 1, Option.some("correct"), Option.some(1))
          );
          expect(
            yield* world.answer("learner", "running", "incorrect", 2)
          ).toEqual(Option.none());
          expect(yield* world.observe).toEqual(
            running(1, 0, Option.some("incorrect"), Option.some(2))
          );
          expect(yield* world.answer("learner", "running", "clear", 3)).toEqual(
            Option.none()
          );
          expect(yield* world.observe).toEqual(
            running(0, 0, Option.none(), Option.some(3))
          );
        })
    );
    it.effect("repeats an answer and a clear without changing counters", () =>
      Effect.gen(function* () {
        const world = yield* fixture.seed;
        yield* world.answer("learner", "running", "correct", 1);
        yield* world.answer("learner", "running", "correct", 2);
        expect(yield* world.observe).toEqual(
          running(1, 1, Option.some("correct"), Option.some(2))
        );
        yield* world.answer("learner", "running", "clear", 3);
        expect(yield* world.answer("learner", "running", "clear", 4)).toEqual(
          Option.none()
        );
        expect(yield* world.observe).toEqual(
          running(0, 0, Option.none(), Option.some(4))
        );
      })
    );
    it.effect(
      "keeps the version of a cleared answer, so no write that an older one overtook comes back",
      () =>
        Effect.gen(function* () {
          const world = yield* fixture.seed;
          yield* world.answer("learner", "running", "correct", 1);
          yield* world.answer("learner", "running", "incorrect", 2);
          yield* world.answer("learner", "running", "clear", 3);
          for (const version of [2, 3]) {
            yield* refused(
              world,
              world.answer("learner", "running", "correct", version),
              fixture.stale
            );
          }
          expect(
            yield* world.answer("learner", "running", "incorrect", 4)
          ).toEqual(Option.none());
          expect(yield* world.observe).toEqual(
            running(1, 0, Option.some("incorrect"), Option.some(4))
          );
          yield* refused(
            world,
            world.answer("learner", "running", "correct", 3),
            fixture.stale
          );
        })
    );
    it.effect("numbers a clear of nothing like any other write", () =>
      Effect.gen(function* () {
        const world = yield* fixture.seed;
        expect(yield* world.answer("learner", "running", "clear", 2)).toEqual(
          Option.none()
        );
        expect(yield* world.observe).toEqual(
          running(0, 0, Option.none(), Option.some(2))
        );
        yield* refused(
          world,
          world.answer("learner", "running", "correct", 2),
          fixture.stale
        );
      })
    );
    it.effect(
      "counts an answer awaiting the grader as answered, never correct",
      () =>
        Effect.gen(function* () {
          const world = yield* fixture.seed;
          yield* world.answer("learner", "running", "pending", 1);
          expect(yield* world.observe).toEqual(
            running(1, 0, Option.some("pending"), Option.some(1))
          );
        })
    );
    it.effect(
      "stores an incomplete answer without counting it as answered",
      () =>
        Effect.gen(function* () {
          const world = yield* fixture.seed;
          yield* world.answer("learner", "running", "incomplete", 1);
          expect(yield* world.observe).toEqual(
            running(0, 0, Option.some("incorrect"), Option.some(1))
          );
        })
    );
    it.effect.each(rejections)(
      "rejects a selection that does not belong ($pick)",
      ({ pick, reason }) =>
        Effect.gen(function* () {
          const world = yield* fixture.seed;
          yield* refused(
            world,
            world.answer("learner", "running", pick, 1),
            fixture.rejection(reason)
          );
        })
    );
    it.effect.each(refusals)(
      "refuses an answer and a finish on $case",
      ({ caller, changes, reason, target }) =>
        Effect.gen(function* () {
          for (const kind of WRITES) {
            const world = yield* fixture.seed;
            yield* Effect.forEach(changes, world.arrange);
            yield* refused(
              world,
              write(world, kind, caller, target),
              fixture.refusal(kind, reason)
            );
          }
        })
    );
    it.effect("refuses an answer once only its section's deadline passed", () =>
      Effect.gen(function* () {
        const world = yield* fixture.seed;
        yield* world.arrange("expire-section");
        yield* refused(
          world,
          world.answer("learner", "running", "correct", 1),
          fixture.refusal("answer", "Expired")
        );
      })
    );
    it.effect(
      "refuses a finish on a passed deadline before reading the section",
      () =>
        Effect.gen(function* () {
          const world = yield* fixture.seed;
          yield* world.arrange("duplicate-section");
          yield* world.arrange("expire-attempt");
          yield* refused(
            world,
            world.finish("learner", "running"),
            fixture.refusal("finish", "Expired")
          );
        })
    );
    it.effect(
      "refuses an answer whose version is not newer than the latest write, and changes nothing",
      () =>
        Effect.gen(function* () {
          const world = yield* fixture.seed;
          yield* world.answer("learner", "running", "correct", 5);
          for (const version of [5, 4, 1]) {
            yield* refused(
              world,
              world.answer("learner", "running", "incorrect", version),
              fixture.stale
            );
          }
          expect(yield* world.observe).toEqual(
            running(1, 1, Option.some("correct"), Option.some(5))
          );
          expect(
            yield* world.answer("learner", "running", "incorrect", 6)
          ).toEqual(Option.none());
          expect(yield* world.observe).toEqual(
            running(1, 0, Option.some("incorrect"), Option.some(6))
          );
        })
    );
    it.effect.each(endings)(
      "refuses a stale answer to a write that $reason refuses first",
      ({ change, reason }) =>
        Effect.gen(function* () {
          const world = yield* fixture.seed;
          yield* world.answer("learner", "running", "correct", 5);
          yield* world.arrange(change);
          yield* refused(
            world,
            world.answer("learner", "running", "incorrect", 1),
            fixture.refusal("answer", reason)
          );
        })
    );
    it.effect("refuses a stale answer before it rejects the selection", () =>
      Effect.gen(function* () {
        const world = yield* fixture.seed;
        yield* world.answer("learner", "running", "correct", 5);
        yield* refused(
          world,
          world.answer("learner", "running", "invalid", 1),
          fixture.stale
        );
      })
    );
    it.effect("finishes a running section as submitted, once", () =>
      Effect.gen(function* () {
        const world = yield* fixture.seed;
        yield* world.answer("learner", "running", "correct", 1);
        expect(yield* world.finish("learner", "running")).toEqual(
          Option.none()
        );
        expect(yield* world.observe).toEqual({
          answered: 1,
          correct: 1,
          outcome: Option.some("correct"),
          section: "submitted",
          version: Option.some(1),
        });
        yield* refused(
          world,
          world.finish("learner", "running"),
          fixture.refusal("finish", "SectionClosed")
        );
      })
    );
    it.effect("finishes a section past its own deadline as time-expired", () =>
      Effect.gen(function* () {
        const world = yield* fixture.seed;
        yield* world.arrange("expire-section");
        expect(yield* world.finish("learner", "running")).toEqual(
          Option.none()
        );
        expect(yield* world.observe).toEqual({
          answered: 0,
          correct: 0,
          outcome: Option.none(),
          section: "time-expired",
          version: Option.none(),
        });
      })
    );
    it.effect("masks a store failure on the learner's own rows", () =>
      Effect.gen(function* () {
        const world = yield* fixture.seed;
        yield* world.arrange("duplicate-section");
        for (const kind of WRITES) {
          yield* refused(
            world,
            write(world, kind, "learner", "running"),
            fixture.masked(kind)
          );
        }
      })
    );
    it.effect.each(fixture.corruptions)("fails closed on $name", (corruption) =>
      Effect.gen(function* () {
        const world = yield* fixture.seed;
        yield* corruption.arrange(world);
        yield* refused(
          world,
          write(world, corruption.write, "learner", "running"),
          corruption.failure
        );
      })
    );
  });
}
