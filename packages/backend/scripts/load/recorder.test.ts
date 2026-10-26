import { describe, expect, it } from "@effect/vitest";
import {
  Recorder,
  recorderLayer,
  timed,
} from "@repo/backend/scripts/load/recorder";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

describe("load recorder", () => {
  it.effect("records how long a call took and passes its value through", () =>
    Effect.gen(function* () {
      const call = yield* Effect.forkChild(
        timed(
          "mutation:answer",
          Effect.as(Effect.sleep(Duration.millis(42)), "saved")
        )
      );
      yield* TestClock.adjust(Duration.millis(42));
      expect(yield* Fiber.join(call)).toBe("saved");
      const recorder = yield* Recorder;
      expect(yield* recorder.samples).toEqual([
        { failed: false, value: 42, name: "mutation:answer" },
      ]);
    }).pipe(Effect.provide(recorderLayer))
  );

  it.effect("records a failed call as failed and keeps its failure", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        timed("mutation:enter", Effect.fail("refused"))
      );
      expect(failure).toBe("refused");
      const recorder = yield* Recorder;
      expect(yield* recorder.samples).toEqual([
        { failed: true, value: 0, name: "mutation:enter" },
      ]);
    }).pipe(Effect.provide(recorderLayer))
  );

  it.effect("keeps every acknowledged answer in the order it came", () =>
    Effect.gen(function* () {
      const recorder = yield* Recorder;
      const first = {
        attempt: "a",
        question: "q1",
        response: ["option-1"],
        version: 1,
      };
      const second = { ...first, version: 2 };
      yield* recorder.acknowledge(first);
      yield* recorder.acknowledge(second);
      expect(yield* recorder.acknowledged).toEqual([first, second]);
    }).pipe(Effect.provide(recorderLayer))
  );
});
