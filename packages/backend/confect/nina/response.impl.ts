import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { reportFailure } from "@repo/backend/confect/nina/diagnostics";
import { NinaGenerationError } from "@repo/backend/confect/nina/failure";
import { generateResponse } from "@repo/backend/confect/nina/generation";
import { curateMemory } from "@repo/backend/confect/nina/memory/curate";
import { generatePresentation } from "@repo/backend/confect/nina/presentation";
import spec from "@repo/backend/confect/nina/response.spec";
import { refreshSummary } from "@repo/backend/confect/nina/summary";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import { Cause, Effect, Exit, Layer, Option, Schema } from "effect";

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
    yield* generateResponse(turn).pipe(
      Effect.provide(GatewayLive),
      Effect.catchTag("GatewayConfigurationError", () =>
        Effect.fail(
          new NinaGenerationError({ reason: "service-configuration" })
        )
      ),
      Effect.onExit((exit) => {
        const failure = Exit.isFailure(exit)
          ? Cause.findErrorOption(exit.cause).pipe(
              Option.filter(Schema.is(NinaGenerationError)),
              Option.map((error) => error.reason),
              Option.getOrElse(() => "unknown" as const)
            )
          : undefined;
        return mutate(refs.internal.nina.lifecycle.recover, {
          ...args,
          ...(failure ? { failure } : {}),
        }).pipe(Effect.orDie);
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
    // Title, suggestions, the rolling summary and learner memory are optional,
    // independent follow-up work.
    yield* Effect.all(
      [
        generatePresentation(turn, usageHandler),
        refreshSummary(turn),
        curateMemory(turn),
      ],
      { concurrency: "unbounded", discard: true }
    ).pipe(
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
