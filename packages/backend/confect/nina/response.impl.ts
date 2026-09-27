import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { reportFailure } from "@repo/backend/confect/nina/diagnostics";
import { NinaGenerationError } from "@repo/backend/confect/nina/failure";
import { generateResponse } from "@repo/backend/confect/nina/generation";
import spec from "@repo/backend/confect/nina/response.spec";
import { Cause, Effect, Exit, Layer, Option, Schema } from "effect";

const run = FunctionImpl.make(
  schema,
  spec,
  "run",
  Effect.fn("nina.response.run")(function* (args) {
    const mutate = yield* MutationRunner;
    const turn = yield* mutate(refs.internal.nina.lifecycle.claim, args).pipe(
      Effect.orDie
    );
    if (!turn) {
      return null;
    }
    yield* generateResponse(turn).pipe(
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

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
