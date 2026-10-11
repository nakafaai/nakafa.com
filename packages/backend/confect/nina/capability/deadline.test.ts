import { describe, expect, it } from "@effect/vitest";
import { purposes } from "@repo/backend/confect/gateway/purpose";
import {
  boundCapability,
  CAPABILITY_BUDGET,
  ChatStep,
  limitDeadline,
  makeChatStep,
  timeLeft,
} from "@repo/backend/confect/nina/capability/deadline";
import { inNewChatStep, withTimeLeft } from "@repo/backend/test/nina/deadline";
import { Clock, Duration, Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";

/** What takes the place of a run that is cut, in tests where no run may be. */
const cutIsAFailure = Effect.die("The run was cut at its deadline.");

/** The longest run's budget, less `part` of it. */
const budgetLess = (part: Duration.Input) =>
  Duration.subtract(CAPABILITY_BUDGET, Duration.fromInputUnsafe(part));

/** Starts a run that never ends in `step`, and gives its fiber. */
const startNeverEnding = (step: ChatStep["Service"]) =>
  Effect.forkChild(
    boundCapability(Effect.never, Effect.succeed("timed out")).pipe(
      Effect.provideService(ChatStep, step)
    )
  );

describe("a capability run's deadline", () => {
  it.effect("cuts a run that never ends before its chat step could end", () =>
    Effect.gen(function* () {
      const stopped = yield* Ref.make(false);
      const fiber = yield* Effect.forkChild(
        boundCapability(
          Effect.never.pipe(Effect.ensuring(Ref.set(stopped, true))),
          Effect.succeed("timed out")
        ).pipe(inNewChatStep)
      );
      yield* TestClock.adjust(budgetLess("1 millis"));
      expect(fiber.pollUnsafe()).toBeUndefined();
      yield* TestClock.adjust("1 millis");
      expect(yield* Fiber.join(fiber)).toBe("timed out");
      // Interrupting the run is what aborts the model calls it has in flight.
      expect(yield* Ref.get(stopped)).toBe(true);
      expect(
        Duration.isLessThan(
          CAPABILITY_BUDGET,
          Duration.millis(purposes.chat.timeout.stepMs)
        )
      ).toBe(true);
    })
  );

  it.effect(
    "counts the time from the start of the chat step, which Nina's own call has used",
    () =>
      Effect.gen(function* () {
        const step = yield* makeChatStep();
        // Nina's own call, which wrote the tool call, took 25 seconds of the step.
        yield* TestClock.adjust("25 seconds");
        const fiber = yield* startNeverEnding(step);
        yield* TestClock.adjust(budgetLess("25001 millis"));
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("1 millis");
        expect(fiber.pollUnsafe()).toBeDefined();
        expect(yield* Fiber.join(fiber)).toBe("timed out");
      })
  );

  it.effect("counts each step of a turn from its own start", () =>
    Effect.gen(function* () {
      const step = yield* makeChatStep();
      // The first step is long over when the next one begins.
      yield* TestClock.adjust(CAPABILITY_BUDGET);
      yield* TestClock.adjust("20 seconds");
      yield* step.begin;
      yield* TestClock.adjust("5 seconds");
      const fiber = yield* startNeverEnding(step);
      yield* TestClock.adjust(budgetLess("5001 millis"));
      expect(fiber.pollUnsafe()).toBeUndefined();
      yield* TestClock.adjust("1 millis");
      expect(fiber.pollUnsafe()).toBeDefined();
      expect(yield* Fiber.join(fiber)).toBe("timed out");
    })
  );

  it.effect("remembers when the latest chat step began", () =>
    Effect.gen(function* () {
      const step = yield* makeChatStep();
      expect(yield* step.startedAt).toBe(yield* Clock.currentTimeMillis);
      yield* TestClock.adjust("30 seconds");
      yield* step.begin;
      const began = yield* Clock.currentTimeMillis;
      yield* TestClock.adjust("5 seconds");
      expect(yield* step.startedAt).toBe(began);
    })
  );

  it.effect.each([
    ["with a millisecond of its step left", "1 millis", 1, "started"],
    ["when its step has run out", "0 millis", 0, "timed out"],
  ] as const)(
    "starts a run only while its chat step has time: %s",
    ([, left, starts, result]) =>
      Effect.gen(function* () {
        const step = yield* makeChatStep();
        yield* TestClock.adjust(budgetLess(left));
        const started = yield* Ref.make(0);
        expect(
          yield* boundCapability(
            Effect.as(
              Ref.update(started, (count) => count + 1),
              "started"
            ),
            Effect.succeed("timed out")
          ).pipe(Effect.provideService(ChatStep, step))
        ).toBe(result);
        expect(yield* Ref.get(started)).toBe(starts);
      })
  );

  it.effect(
    "tells a run how much time is left, counting down with the clock",
    () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          boundCapability(
            Effect.gen(function* () {
              const first = yield* timeLeft;
              yield* Effect.sleep("10 seconds");
              return [first, yield* timeLeft] as const;
            }),
            cutIsAFailure
          ).pipe(inNewChatStep)
        );
        yield* TestClock.adjust("10 seconds");
        const [first, second] = yield* Fiber.join(fiber);
        expect(Duration.isLessThan(first, CAPABILITY_BUDGET)).toBe(true);
        expect(Duration.toMillis(first) - Duration.toMillis(second)).toBe(
          10_000
        );
      })
  );

  it.effect(
    "tells a run only what is left of its step after the part Nina's own call used",
    () =>
      Effect.gen(function* () {
        const step = yield* makeChatStep();
        const bound = boundCapability(timeLeft, cutIsAFailure).pipe(
          Effect.provideService(ChatStep, step)
        );
        const atStart = yield* bound;
        yield* TestClock.adjust("25 seconds");
        const later = yield* bound;
        expect(Duration.toMillis(atStart) - Duration.toMillis(later)).toBe(
          25_000
        );
      })
  );

  it.effect(
    "ends the calls inside a run before the run, so they can report",
    () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          boundCapability(
            Effect.flatMap(timeLeft, (left) =>
              Effect.as(Effect.sleep(left), "reported")
            ),
            cutIsAFailure
          ).pipe(inNewChatStep)
        );
        // A millisecond short of the run's own deadline, the call has ended.
        yield* TestClock.adjust(budgetLess("1 millis"));
        expect(fiber.pollUnsafe()).toBeDefined();
        expect(yield* Fiber.join(fiber)).toBe("reported");
      })
  );

  it.effect(
    "never reports negative time once the calls should have ended",
    () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          boundCapability(
            Effect.andThen(Effect.sleep(budgetLess("1 seconds")), timeLeft),
            cutIsAFailure
          ).pipe(inNewChatStep)
        );
        yield* TestClock.adjust(CAPABILITY_BUDGET);
        expect(Duration.toMillis(yield* Fiber.join(fiber))).toBe(0);
      })
  );

  it.effect(
    "cuts an AI SDK deadline to the time left and keeps its other limits",
    () =>
      Effect.gen(function* () {
        expect(yield* limitDeadline(purposes.chat.timeout)).toEqual({
          chunkMs: 45_000,
          stepMs: 5000,
          totalMs: 5000,
        });
      }).pipe(withTimeLeft("5 seconds"))
  );

  it.effect("leaves a call outside any run with only its own limits", () =>
    Effect.gen(function* () {
      expect(yield* limitDeadline(purposes.chat.timeout)).toEqual(
        purposes.chat.timeout
      );
    })
  );

  it.effect("keeps an AI SDK deadline that already fits the time left", () =>
    Effect.gen(function* () {
      expect(yield* limitDeadline(purposes.specialist.timeout)).toEqual(
        purposes.specialist.timeout
      );
    }).pipe(withTimeLeft("10 minutes"))
  );
});
