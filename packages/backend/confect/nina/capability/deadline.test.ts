import { describe, expect, it } from "@effect/vitest";
import { purposes } from "@repo/backend/confect/gateway/purpose";
import {
  boundCapability,
  CAPABILITY_BUDGET,
  limitDeadline,
  limitDuration,
  timeLeft,
} from "@repo/backend/confect/nina/capability/deadline";
import { withTimeLeft } from "@repo/backend/test/nina/deadline";
import { Duration, Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";

/** What takes the place of a run that is cut, in tests where no run may be. */
const cutIsAFailure = Effect.die("The run was cut at its deadline.");

describe("a capability run's deadline", () => {
  it.effect("cuts a run that never ends before its chat step could end", () =>
    Effect.gen(function* () {
      const stopped = yield* Ref.make(false);
      const fiber = yield* Effect.forkChild(
        boundCapability(
          Effect.never.pipe(Effect.ensuring(Ref.set(stopped, true))),
          Effect.succeed("timed out")
        )
      );
      yield* TestClock.adjust(
        Duration.subtract(CAPABILITY_BUDGET, Duration.millis(1))
      );
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
          )
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
    "ends the calls inside a run before the run, so they can report",
    () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          boundCapability(
            Effect.flatMap(timeLeft, (left) =>
              Effect.as(Effect.sleep(left), "reported")
            ),
            cutIsAFailure
          )
        );
        yield* TestClock.adjust(CAPABILITY_BUDGET);
        expect(yield* Fiber.join(fiber)).toBe("reported");
      })
  );

  it.effect(
    "never reports negative time once the calls should have ended",
    () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          boundCapability(
            Effect.andThen(
              Effect.sleep(
                Duration.subtract(CAPABILITY_BUDGET, Duration.seconds(1))
              ),
              timeLeft
            ),
            cutIsAFailure
          )
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
      expect(
        Duration.toMillis(yield* limitDuration(Duration.seconds(12)))
      ).toBe(12_000);
    })
  );

  it.effect("keeps an AI SDK deadline that already fits the time left", () =>
    Effect.gen(function* () {
      expect(yield* limitDeadline(purposes.specialist.timeout)).toEqual(
        purposes.specialist.timeout
      );
    }).pipe(withTimeLeft("10 minutes"))
  );

  it.effect.each([
    ["5 seconds", "12 seconds", "5 seconds"],
    ["60 seconds", "12 seconds", "12 seconds"],
  ] as const)(
    "cuts a limit to the time left: %s left, limit %s",
    ([left, limit, cut]) =>
      Effect.gen(function* () {
        expect(
          Duration.toMillis(
            yield* limitDuration(Duration.fromInputUnsafe(limit))
          )
        ).toBe(Duration.toMillis(cut));
      }).pipe(withTimeLeft(left))
  );
});
