import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { reportFailure } from "@repo/backend/confect/nina/diagnostics";
import {
  causeReason,
  NinaGenerationError,
} from "@repo/backend/confect/nina/failure";
import { generateResponse } from "@repo/backend/confect/nina/generation";
import { turnHalted, watchHalt } from "@repo/backend/confect/nina/halt";
import { makeTiming } from "@repo/backend/confect/nina/timing";
import { type Cause, Effect, Exit, Option } from "effect";

/**
 * Notes that a generation ended because its turn was halted, whichever of the
 * watch or Agent noticed first. The settlement says how the turn ended, so the
 * cause needs no report, but it is not lost: the log keeps the turn and the
 * reason the cause names, and never a message, since a provider's message may
 * quote the conversation.
 */
const logHalted = (
  turnId: Docs["ninaTurns"]["_id"],
  cause: Cause.Cause<unknown>
) =>
  Effect.logInfo("Nina run ended after its turn was halted", {
    turnId,
    reason: causeReason(cause),
  });

/**
 * Answers one turn: claims it, generates its answer, and settles it. The default
 * runtime (`nina/response`) and the Node runtime (`nina/documents`) both run this
 * program, so each runtime reaches the same settlement (ADR 0019).
 */
export const answerTurn = Effect.fn("nina.response.run")(function* (args: {
  readonly turnId: Docs["ninaTurns"]["_id"];
}) {
  const { runMutation: mutate } = yield* MutationRunner;
  const turn = yield* mutate(refs.internal.nina.lifecycle.claim, args).pipe(
    Effect.orDie
  );
  if (!turn) {
    return null;
  }
  const halt = yield* watchHalt(turn._id);
  const timing = yield* makeTiming(turn);
  yield* generateResponse(turn, halt, timing).pipe(
    Effect.provide(GatewayLive),
    Effect.catchTag("GatewayConfigurationError", () =>
      Effect.fail(new NinaGenerationError({ reason: "service-configuration" }))
    ),
    // What the history of the prompt cost is known only for an answer that
    // ended well. The settlement stores it with the stages the run reached.
    Effect.asSome,
    // A generation that ends because its turn was stopped or settled elsewhere
    // has nothing left to report, whichever of the watch or Agent noticed
    // first. Its settlement below always does.
    Effect.catchCause((cause) =>
      Effect.flatMap(turnHalted(turn._id), (halted) =>
        halted
          ? Effect.as(logHalted(turn._id, cause), Option.none())
          : Effect.failCause(cause)
      )
    ),
    Effect.onExit((exit) => {
      const failure = Exit.isFailure(exit)
        ? causeReason(exit.cause)
        : undefined;
      const history = Exit.isSuccess(exit)
        ? Option.getOrUndefined(exit.value)
        : undefined;
      return Effect.flatMap(timing.read, (reached) =>
        mutate(refs.internal.nina.lifecycle.recover, {
          ...args,
          ...(failure ? { failure } : {}),
          ...(history ? { history } : {}),
          timing: reached,
        }).pipe(Effect.orDie)
      );
    }),
    // The scheduled action boundary preserves diagnostics while the durable
    // lifecycle reconciles completed output or refunds the failed response.
    Effect.catchCause((cause) => reportFailure(turn, cause))
  );
  return null;
});
