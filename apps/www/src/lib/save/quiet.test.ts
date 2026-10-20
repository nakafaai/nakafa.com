import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref } from "effect";
import { TestClock } from "effect/testing";
import { makeQuietSaver } from "@/lib/save/quiet";

/** A saver whose work records each input it runs, in order. */
const recordingSaver = Effect.gen(function* () {
  const runs = yield* Ref.make<readonly number[]>([]);
  const saver = yield* makeQuietSaver(
    (input: number) => Ref.update(runs, (done) => [...done, input]),
    "250 millis"
  );
  return { runs, saver };
});

describe("makeQuietSaver", () => {
  it.effect("runs the newest input once the input has been quiet", () =>
    Effect.gen(function* () {
      const { runs, saver } = yield* recordingSaver;

      yield* saver.touch(1);
      yield* saver.touch(2);
      yield* TestClock.adjust("249 millis");
      expect(yield* Ref.get(runs)).toEqual([]);

      yield* TestClock.adjust("1 millis");
      expect(yield* Ref.get(runs)).toEqual([2]);
    })
  );

  it.effect("starts the quiet period again on each input", () =>
    Effect.gen(function* () {
      const { runs, saver } = yield* recordingSaver;

      yield* saver.touch(1);
      yield* TestClock.adjust("200 millis");
      yield* saver.touch(2);
      yield* TestClock.adjust("200 millis");
      expect(yield* Ref.get(runs)).toEqual([]);

      yield* TestClock.adjust("50 millis");
      expect(yield* Ref.get(runs)).toEqual([2]);
    })
  );

  it.effect("runs the waiting input at once when it is flushed", () =>
    Effect.gen(function* () {
      const { runs, saver } = yield* recordingSaver;

      yield* saver.touch(7);
      yield* saver.flush;
      expect(yield* Ref.get(runs)).toEqual([7]);

      yield* TestClock.adjust("1 second");
      expect(yield* Ref.get(runs)).toEqual([7]);
    })
  );

  it.effect("does nothing when it is flushed with no input waiting", () =>
    Effect.gen(function* () {
      const { runs, saver } = yield* recordingSaver;

      yield* saver.flush;
      expect(yield* Ref.get(runs)).toEqual([]);
    })
  );

  it.effect("drops the waiting input without running it when cancelled", () =>
    Effect.gen(function* () {
      const { runs, saver } = yield* recordingSaver;

      yield* saver.touch(1);
      yield* saver.cancel;
      yield* TestClock.adjust("1 second");
      yield* saver.flush;
      expect(yield* Ref.get(runs)).toEqual([]);
    })
  );

  it.effect("does nothing when it is cancelled with no input waiting", () =>
    Effect.gen(function* () {
      const { runs, saver } = yield* recordingSaver;

      yield* saver.cancel;
      expect(yield* Ref.get(runs)).toEqual([]);
    })
  );

  it.effect("runs only the input that is given after a cancel", () =>
    Effect.gen(function* () {
      const { runs, saver } = yield* recordingSaver;

      yield* saver.touch(1);
      yield* saver.cancel;
      yield* saver.touch(2);
      yield* TestClock.adjust("250 millis");
      expect(yield* Ref.get(runs)).toEqual([2]);
    })
  );
});
