import type { Purpose } from "@repo/backend/confect/gateway/purpose";
import { Meter, metered } from "@repo/backend/confect/spend/meter";
import {
  languageCeiling,
  languageCost,
  reportedCost,
} from "@repo/backend/confect/spend/rates";
import type { Escrow } from "@repo/backend/confect/spend/schema";
import type { LanguageModelMiddleware } from "ai";
import { Effect, Exit } from "effect";

type Meters = Meter["Service"];

/** The answer of one language model call, as a middleware receives it. */
type Generated = Awaited<
  ReturnType<
    Parameters<
      NonNullable<LanguageModelMiddleware["wrapGenerate"]>
    >[0]["doGenerate"]
  >
>;

/** The stream of one language model call, as a middleware receives it. */
type Streamed = Awaited<
  ReturnType<
    Parameters<
      NonNullable<LanguageModelMiddleware["wrapStream"]>
    >[0]["doStream"]
  >
>;

type StreamPart =
  Streamed["stream"] extends ReadableStream<infer Part> ? Part : never;

/**
 * What one call cost: the cost the gateway reported, which is the bill, or its
 * tokens at the public rates when it reported none. A call whose tokens are
 * not reported either costs its whole hold, because nothing shows it cost less.
 */
export function callCost(
  usage: Generated["usage"],
  metadata: Generated["providerMetadata"],
  held: number
) {
  const cost = metadata?.convexGateway?.cost;
  if (typeof cost === "number") {
    return reportedCost(cost);
  }
  const input = usage.inputTokens.total;
  const output = usage.outputTokens.total;
  if (input === undefined || output === undefined) {
    return held;
  }
  return languageCost({
    input,
    output,
    cacheRead: usage.inputTokens.cacheRead ?? 0,
    cacheWrite: usage.inputTokens.cacheWrite ?? 0,
  });
}

/**
 * Passes a stream on unchanged and settles its escrow before it ends: to the
 * cost its finish part reports, or to the whole hold when the stream ends
 * without one, fails, or is cancelled. It reads the provider's stream only when
 * its reader asks for a part, so the provider is asked for each part exactly
 * when it would be without the escrow, and the AI SDK's chunk and step timers
 * see the same stream.
 */
function settling(meter: Meters, escrow: Escrow, source: Streamed["stream"]) {
  const reader = source.getReader();
  let spent = escrow.held;
  return new ReadableStream<StreamPart>(
    {
      pull: (controller) =>
        Effect.runPromise(
          // The provider's own failure passes through untouched, as a defect,
          // so the AI SDK reads and retries it as it would without the escrow.
          Effect.promise(() => reader.read()).pipe(
            Effect.onError(() => meter.settle(escrow, escrow.held)),
            Effect.flatMap((read) => {
              if (read.done) {
                return Effect.andThen(
                  meter.settle(escrow, spent),
                  Effect.sync(() => controller.close())
                );
              }
              if (read.value.type === "finish") {
                spent = callCost(
                  read.value.usage,
                  read.value.providerMetadata,
                  escrow.held
                );
              }
              return Effect.sync(() => controller.enqueue(read.value));
            })
          )
        ),
      cancel: (reason) =>
        Effect.runPromise(
          Effect.andThen(
            meter.settle(escrow, escrow.held),
            Effect.promise(() => reader.cancel(reason))
          )
        ),
    },
    { highWaterMark: 0 }
  );
}

/**
 * Escrows every call of one purpose's language model: its ceiling is held
 * before the provider is called, and the call settles to what it cost. The AI
 * SDK calls a middleware through Promises, so this is its framework boundary:
 * the provider's call runs as `Effect.promise`, so a rejection reaches the SDK
 * as the very error the provider raised, which its retries and `classify`
 * read. A refused hold fails the call before any token is bought.
 */
export function escrowed(
  meter: Meters,
  purpose: Purpose
): LanguageModelMiddleware {
  const held = languageCeiling(purpose);
  return {
    specificationVersion: "v4",
    wrapGenerate: ({ doGenerate }) =>
      Effect.runPromise(
        metered(purpose, held, Effect.promise(doGenerate), (result) =>
          callCost(result.usage, result.providerMetadata, held)
        ).pipe(Effect.provideService(Meter, meter))
      ),
    wrapStream: ({ doStream }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const escrow = yield* meter.hold(purpose, held);
          const result = yield* Effect.promise(doStream).pipe(
            Effect.onExit((exit) =>
              Exit.isSuccess(exit) ? Effect.void : meter.settle(escrow, held)
            )
          );
          return {
            ...result,
            stream: settling(meter, escrow, result.stream),
          };
        })
      ),
  };
}
