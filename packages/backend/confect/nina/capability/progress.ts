import { boundText, NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import { DataPartSchema } from "@repo/backend/confect/nina/contract/data";
import { Effect, Exit, Queue, Schema, Stream } from "effect";

/** Evidence cards keep their existing identities across progressive updates. */
export const CapabilityArtifactSchema = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal("data-math"),
    data: DataPartSchema.fields.math,
  }),
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal("data-nakafa"),
    data: DataPartSchema.fields.nakafa,
  }),
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal("data-scrape-url"),
    data: DataPartSchema.fields["scrape-url"],
  }),
  Schema.Struct({
    id: Schema.String,
    type: Schema.Literal("data-web-search"),
    data: DataPartSchema.fields["web-search"],
  }),
]);

export type CapabilityArtifact = Schema.Schema.Type<
  typeof CapabilityArtifactSchema
>;

/** The final output owns every card; model context can project only its text. */
export const CapabilityOutputSchema = Schema.Struct({
  artifacts: Schema.Array(CapabilityArtifactSchema),
  failure: Schema.optionalKey(
    Schema.Literals(["failed", "denied", "sourceLimit"])
  ),
  text: Schema.String,
});

export type CapabilityOutput = Schema.Schema.Type<
  typeof CapabilityOutputSchema
>;

export type CapabilityProgress = (
  artifact: CapabilityArtifact
) => Effect.Effect<void>;

/**
 * Each Agent tool yield replaces its previous output, so every yield includes
 * all cards gathered by this invocation. Slow consumers coalesce intermediate
 * snapshots without losing cards or the final evidence. Closing the stream
 * interrupts the scoped capability, including its provider and tool requests.
 * Final model-facing text never exceeds the evidence budget; `continuation`
 * tells the model how to ask for what a truncation omitted.
 */
export function streamCapability<E, R>(
  run: (
    publish: CapabilityProgress
  ) => Effect.Effect<Pick<CapabilityOutput, "text" | "failure">, E, R>,
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
        const artifacts = new Map<string, CapabilityArtifact>();
        const publish = Effect.fn("nina.capability.progress")(function* (
          artifact: CapabilityArtifact
        ) {
          artifacts.set(`${artifact.type}:${artifact.id}`, artifact);
          yield* Queue.offer(queue, {
            artifacts: [...artifacts.values()],
            text: "",
          });
        });

        yield* run(publish).pipe(
          Effect.tap(({ text, failure }) =>
            Queue.offer(queue, {
              artifacts: [...artifacts.values()],
              ...(failure ? { failure } : {}),
              text: boundText(text, NINA_BUDGET.evidence, continuation),
            })
          ),
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
