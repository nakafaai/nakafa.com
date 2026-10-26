import type { Acknowledged } from "@repo/backend/scripts/load/ledger";
import type { Sample } from "@repo/backend/scripts/load/stats";
import { Clock, Context, Effect, Exit, Layer, MutableList } from "effect";

/**
 * Collects what a run measures: every timed call, and every answer whose write the server
 * acknowledged. Thousands of students write into it at once, so it appends in place and is
 * read only once the run has ended.
 */
export class Recorder extends Context.Service<
  Recorder,
  {
    readonly acknowledge: (answer: Acknowledged) => Effect.Effect<void>;
    readonly acknowledged: Effect.Effect<readonly Acknowledged[]>;
    readonly sample: (sample: Sample) => Effect.Effect<void>;
    readonly samples: Effect.Effect<readonly Sample[]>;
  }
>()("@repo/backend/scripts/load/recorder") {}

/** A recorder that keeps everything in memory for the run that it belongs to. */
export const recorderLayer = Layer.sync(Recorder, () => {
  const samples = MutableList.make<Sample>();
  const answers = MutableList.make<Acknowledged>();
  return Recorder.of({
    acknowledge: (answer) =>
      Effect.sync(() => MutableList.append(answers, answer)),
    acknowledged: Effect.sync(() => MutableList.toArray(answers)),
    sample: (sample) => Effect.sync(() => MutableList.append(samples, sample)),
    samples: Effect.sync(() => MutableList.toArray(samples)),
  });
});

/**
 * Runs one call and records how long it took under `name`, and whether it failed. The call's
 * own result or failure passes through unchanged.
 */
export const timed = Effect.fn("load.recorder.timed")(function* <A, E, R>(
  name: string,
  call: Effect.Effect<A, E, R>
) {
  const recorder = yield* Recorder;
  const start = yield* Clock.currentTimeMillis;
  const exit = yield* Effect.exit(call);
  const end = yield* Clock.currentTimeMillis;
  yield* recorder.sample({
    failed: Exit.isFailure(exit),
    ms: end - start,
    name,
  });
  return yield* exit;
});
