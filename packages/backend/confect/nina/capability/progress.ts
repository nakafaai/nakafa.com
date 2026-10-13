import type {
  CapabilityArtifactSchema,
  CapabilityOutputSchema,
} from "@repo/backend/client/nina/capability";
import { settleOutcome } from "@repo/backend/client/nina/outcome";
import { boundText, NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import {
  boundCapability,
  type ChatStep,
} from "@repo/backend/confect/nina/capability/deadline";
import type { FinishReason } from "ai";
import {
  Array as Arr,
  Effect,
  Exit,
  MutableHashMap,
  Queue,
  Stream,
} from "effect";

export type CapabilityArtifact = typeof CapabilityArtifactSchema.Type;

export type CapabilityOutput = typeof CapabilityOutputSchema.Type;

export type CapabilityProgress = (
  artifact: CapabilityArtifact
) => Effect.Effect<void>;

/** What Nina reads when a run was cut at its deadline. */
const TIMED_OUT =
  "This ran out of time before it finished. Use only the evidence already available, tell the learner what this attempt could not verify, and do not invent content or claim that anything is absent or does not exist.";

/** What Nina reads when a specialist's answer ended at its output cap. */
const CUT_SHORT =
  "This answer reached its length limit and was cut short. Use only what it states, tell the learner what it could not cover, and do not invent the rest.";

/** What Nina reads when a specialist's loop ended at its step limit, with a tool still called. */
const STEP_LIMIT =
  "This run reached its step limit before it finished. Use only what it states, tell the learner what it could not cover, and do not invent the rest.";

/** What a card that never finished shows instead: failed, and why. */
const ABANDONED = {
  error: "It took too long to finish.",
  status: "error",
} as const;

/**
 * What a specialist reports once its model has finished. A last step that
 * ended at the output cap left the answer cut short, and a loop that ended at
 * its step limit while its last step still called a tool never wrote its
 * answer. Both are `partial` and say so to Nina, as for a run cut at its
 * deadline. Any other ending is a plain answer. That includes a last step that
 * was told to call no tool: a run that has checked everything writes its
 * answer there too, so reaching it does not show that a check was skipped.
 */
export function specialistResult(text: string, finishReason: FinishReason) {
  if (finishReason === "length") {
    return { outcome: "partial" as const, text: `${text}\n\n${CUT_SHORT}` };
  }
  if (finishReason === "tool-calls") {
    return { outcome: "partial" as const, text: `${text}\n\n${STEP_LIMIT}` };
  }
  return { text };
}

/**
 * Each Agent tool yield replaces its previous output, so every yield includes
 * all cards gathered by this invocation. Slow consumers coalesce intermediate
 * snapshots without losing cards or the final evidence. Closing the stream
 * interrupts the scoped capability, including its provider and tool requests.
 * Final model-facing text never exceeds the evidence budget; `continuation`
 * tells the model how to ask for what a truncation omitted. The stored outcome
 * is decided here, from what `run` reports and the cards it gathered, by the
 * rule in `client/nina/outcome.ts` that the page reads a stored result with. A
 * run that ends with no card and states no outcome found nothing, so it is
 * `empty`, unless `capability` publishes no card (`TextOnlyCapabilitySchema`):
 * its answer is the text, and no card is the normal way for it to end.
 *
 * A run has the time its chat step can spare, counted from the start of that
 * step, and its calls see the time left through `CapabilityDeadline`. A run
 * still going at that deadline is interrupted and reported as failed. Its
 * loaded cards stay, its unfinished cards end as errors so none stays loading,
 * and the stored outcome is decided like any other, so it is `partial` beside
 * loaded evidence.
 */
export function streamCapability<E, R>(
  run: (
    publish: CapabilityProgress
  ) => Effect.Effect<Pick<CapabilityOutput, "text" | "outcome">, E, R>,
  {
    capability,
    continuation,
    signal,
  }: {
    readonly capability: string;
    readonly continuation: string;
    readonly signal?: AbortSignal | undefined;
  }
): Stream.Stream<CapabilityOutput, E, R | ChatStep> {
  return Stream.callback<CapabilityOutput, E, R | ChatStep>(
    (queue) =>
      Effect.gen(function* () {
        const artifacts = MutableHashMap.empty<string, CapabilityArtifact>();
        const publish = Effect.fn("nina.capability.progress")(function* (
          artifact: CapabilityArtifact
        ) {
          MutableHashMap.set(artifacts, keyOf(artifact), artifact);
          yield* Queue.offer(queue, {
            artifacts: Arr.fromIterable(MutableHashMap.values(artifacts)),
            text: "",
          });
        });
        const timedOut = Effect.gen(function* () {
          yield* Effect.logWarning("Nina capability ran out of time", {
            capability,
          });
          Arr.forEach(Arr.fromIterable(artifacts), ([key, artifact]) =>
            MutableHashMap.set(artifacts, key, abandon(artifact))
          );
          return { outcome: "failed" as const, text: TIMED_OUT };
        });

        yield* boundCapability(run(publish), timedOut).pipe(
          Effect.tap(({ text, outcome }) => {
            const cards = Arr.fromIterable(MutableHashMap.values(artifacts));
            const settled = settleOutcome(outcome, cards, capability);
            return Queue.offer(queue, {
              artifacts: cards,
              ...(settled ? { outcome: settled } : {}),
              text: boundText(text, NINA_BUDGET.evidence, continuation),
            });
          }),
          Effect.onExit((exit) =>
            Exit.isFailure(exit)
              ? Queue.failCause(queue, exit.cause)
              : Queue.end(queue)
          ),
          Effect.forkScoped
        );
      }),
    { bufferSize: 1, strategy: "sliding" }
  ).pipe(
    Stream.interruptWhen(
      Effect.callback<void>((resume) => {
        if (!signal) {
          return;
        }
        const abort = () => resume(Effect.interrupt);
        if (signal.aborted) {
          abort();
          return;
        }
        signal.addEventListener("abort", abort, { once: true });
        return Effect.sync(() => signal.removeEventListener("abort", abort));
      })
    )
  );
}

/** The identity of a card across its progressive updates. */
function keyOf(artifact: CapabilityArtifact) {
  return `${artifact.type}:${artifact.id}`;
}

/**
 * Ends a card that was still loading when its run was cut: it shows as failed,
 * and every card that already settled stays as it is.
 */
function abandon(artifact: CapabilityArtifact): CapabilityArtifact {
  if (artifact.type === "data-math") {
    return artifact.data.status === "loading"
      ? { ...artifact, data: { ...artifact.data, ...ABANDONED } }
      : artifact;
  }
  if (artifact.type === "data-nakafa") {
    return artifact.data.status === "loading"
      ? { ...artifact, data: { ...artifact.data, ...ABANDONED } }
      : artifact;
  }
  if (artifact.type === "data-scrape-url") {
    return artifact.data.status === "loading"
      ? { ...artifact, data: { ...artifact.data, ...ABANDONED } }
      : artifact;
  }
  return artifact.data.status === "loading"
    ? { ...artifact, data: { ...artifact.data, ...ABANDONED } }
    : artifact;
}
