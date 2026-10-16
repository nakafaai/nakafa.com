import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { reportFailure } from "@repo/backend/confect/nina/diagnostics";
import {
  causeReason,
  NinaGenerationError,
} from "@repo/backend/confect/nina/failure";
import { generateResponse } from "@repo/backend/confect/nina/generation";
import { turnHalted, watchHalt } from "@repo/backend/confect/nina/halt";
import { captureMemory } from "@repo/backend/confect/nina/memory/capture";
import { generatePresentation } from "@repo/backend/confect/nina/presentation";
import spec from "@repo/backend/confect/nina/response.spec";
import { refreshSummary } from "@repo/backend/confect/nina/summary";
import { makeTiming } from "@repo/backend/confect/nina/timing";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import { type Cause, Effect, Exit, Layer, Option } from "effect";

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

const run = FunctionImpl.make(
  schema,
  spec,
  "run",
  Effect.fn("nina.response.run")(function* (args) {
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
        Effect.fail(
          new NinaGenerationError({ reason: "service-configuration" })
        )
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
  })
);

const present = FunctionImpl.make(
  schema,
  spec,
  "present",
  Effect.fn("nina.response.present")(function* (args) {
    const turn = yield* (yield* QueryRunner)
      .runQuery(refs.internal.nina.lifecycle.presentation, args)
      .pipe(Effect.orDie);
    if (!turn) {
      return null;
    }
    const usageHandler = yield* createUsageHandler(turn._id);
    // Title, suggestions, the rolling summary and memory capture are optional,
    // independent follow-up work. Each runs to its end whatever the others do,
    // because a step that dies would otherwise cancel the ones still running.
    // Their failures are raised together once all have ended, so none is lost.
    // The summary gets no usage handler: it is chat upkeep, so its tokens stay
    // on its own row (`NinaUpkeepCall`) and not in the ledger of the turn.
    yield* Effect.all(
      [
        Effect.exit(generatePresentation(turn, usageHandler)),
        Effect.exit(refreshSummary(turn)),
        Effect.exit(captureMemory(turn, usageHandler)),
      ],
      { concurrency: "unbounded" }
    ).pipe(
      Effect.flatMap(Exit.asVoidAll),
      Effect.provide(GatewayLive),
      Effect.catchTag("GatewayConfigurationError", () =>
        Effect.logWarning("Nina presentation configuration unavailable", {
          turnId: turn._id,
        })
      ),
      Effect.orDie
    );
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(run),
  Layer.provide(present),
  GroupImpl.finalize
);
