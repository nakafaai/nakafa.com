import type {
  CapabilityArtifactSchema,
  CapabilityOutcomeSchema,
  CapabilityOutputSchema,
} from "@repo/backend/client/nina/capability";
import { boundText, NINA_BUDGET } from "@repo/backend/confect/nina/budget";
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

type CapabilityOutcome = typeof CapabilityOutcomeSchema.Type;

export type CapabilityProgress = (
  artifact: CapabilityArtifact
) => Effect.Effect<void>;

/**
 * Each Agent tool yield replaces its previous output, so every yield includes
 * all cards gathered by this invocation. Slow consumers coalesce intermediate
 * snapshots without losing cards or the final evidence. Closing the stream
 * interrupts the scoped capability, including its provider and tool requests.
 * Final model-facing text never exceeds the evidence budget; `continuation`
 * tells the model how to ask for what a truncation omitted. The stored outcome
 * is decided here, from what `run` reports and the cards it gathered.
 */
export function streamCapability<E, R>(
  run: (
    publish: CapabilityProgress
  ) => Effect.Effect<Pick<CapabilityOutput, "text" | "outcome">, E, R>,
  {
    continuation,
    signal,
  }: {
    readonly continuation: string;
    readonly signal?: AbortSignal | undefined;
  }
): Stream.Stream<CapabilityOutput, E, R> {
  return Stream.callback<CapabilityOutput, E, R>(
    (queue) =>
      Effect.gen(function* () {
        const artifacts = MutableHashMap.empty<string, CapabilityArtifact>();
        const publish = Effect.fn("nina.capability.progress")(function* (
          artifact: CapabilityArtifact
        ) {
          MutableHashMap.set(
            artifacts,
            `${artifact.type}:${artifact.id}`,
            artifact
          );
          yield* Queue.offer(queue, {
            artifacts: Arr.fromIterable(MutableHashMap.values(artifacts)),
            text: "",
          });
        });

        yield* run(publish).pipe(
          Effect.tap(({ text, outcome }) => {
            const cards = Arr.fromIterable(MutableHashMap.values(artifacts));
            const settled = settleOutcome(outcome, cards);
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

/**
 * Keeps the outcome from contradicting the cards beside it. A card is loaded
 * once it settled without an error, whatever its own vocabulary calls that
 * (`done` for sources, `verified` for a calculation). A run that loaded a card
 * never ends as `failed`, and a run that lost a card never ends as plainly
 * done or empty: it is `partial` beside a loaded card and `failed` without
 * one. `limit` and `denied` are decisions, not results, and stay as stated.
 */
function settleOutcome(
  outcome: CapabilityOutcome | undefined,
  artifacts: readonly CapabilityArtifact[]
) {
  const loaded = Arr.some(
    artifacts,
    ({ data }) => data.status !== "loading" && data.status !== "error"
  );
  const lost = Arr.some(artifacts, ({ data }) => data.status === "error");
  const unstated = !outcome || outcome === "empty";
  if (loaded && (outcome === "failed" || (lost && unstated))) {
    return "partial" as const;
  }
  if (!(outcome || loaded) && lost) {
    return "failed" as const;
  }
  return outcome;
}
