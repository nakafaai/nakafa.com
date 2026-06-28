import {
  CapabilityTrace,
  type LearningCapabilityName,
  type LearningCapabilityResult,
} from "@repo/ai/nina/capability/spec";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { NinaStore } from "@repo/ai/nina/runtime/store";
import { Clock, Effect } from "effect";

/**
 * Runs one LearningCapability and persists a bounded operational trace.
 *
 * Trace persistence is best-effort operational data: failures are reported but
 * never replace the capability evidence that Nina needs for the user answer.
 */
export const traceLearningCapability = Effect.fn("nina.capability.trace")(
  function* <A extends LearningCapabilityResult, R>({
    capability,
    responseMessageIdentifier,
    run,
    toolCallId,
  }: {
    readonly capability: LearningCapabilityName;
    readonly responseMessageIdentifier: string;
    readonly run: Effect.Effect<A, never, R>;
    readonly toolCallId?: string;
  }) {
    const store = yield* NinaStore;
    const reporter = yield* NinaReporter;
    const startedAt = yield* Clock.currentTimeMillis;
    const result = yield* run;
    const endedAt = yield* Clock.currentTimeMillis;

    yield* store
      .saveTrace(
        CapabilityTrace.make({
          capability,
          durationMs: Math.max(0, endedAt - startedAt),
          endedAt,
          evidence: result.evidence,
          responseMessageIdentifier,
          startedAt,
          ...(toolCallId ? { toolCallId } : {}),
        })
      )
      .pipe(
        Effect.catchAll((error) =>
          reporter.report({ error, source: "saveCapabilityTrace" })
        )
      );

    return result;
  }
);
