import { describe, expect, it } from "@effect/vitest";
import {
  Recorder,
  recorderLayer,
  timed,
} from "@repo/backend/scripts/load/recorder";
import { temporaryRecorder } from "@repo/backend/test/load";
import { nodePlatform } from "@repo/backend/test/platform";
import { Duration, Effect, Fiber, FileSystem } from "effect";
import { TestClock } from "effect/testing";

const first = {
  attempt: "a",
  question: "q1",
  response: ["option-1"],
  version: 1,
};
const second = { ...first, version: 2 };

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
    }).pipe(Effect.provide(temporaryRecorder))
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
    }).pipe(Effect.provide(temporaryRecorder))
  );

  it.effect("keeps every acknowledged answer in the order it came", () =>
    Effect.gen(function* () {
      const recorder = yield* Recorder;
      yield* recorder.acknowledge(first);
      yield* recorder.acknowledge(second);
      expect(yield* recorder.acknowledged).toEqual([first, second]);
    }).pipe(Effect.provide(temporaryRecorder))
  );

  it.live("holds no answer before the first acknowledgement", () =>
    Effect.gen(function* () {
      expect(yield* (yield* Recorder).acknowledged).toEqual([]);
    }).pipe(Effect.provide(temporaryRecorder))
  );

  it.live("writes each acknowledgement down the moment it comes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* fs.makeTempFileScoped();
      yield* Effect.gen(function* () {
        yield* (yield* Recorder).acknowledge(first);
        // The line is on disk while the run still holds the recorder, so a killed run keeps it.
        expect(yield* fs.readFileString(path)).toBe(
          `${JSON.stringify(first)}\n`
        );
      }).pipe(Effect.provide(recorderLayer(path)));
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.live("starts empty when a report file is named again", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* fs.makeTempFileScoped();
      yield* fs.writeFileString(path, "the run before");
      yield* Effect.gen(function* () {
        expect(yield* (yield* Recorder).acknowledged).toEqual([]);
      }).pipe(Effect.provide(recorderLayer(path)));
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );
});
