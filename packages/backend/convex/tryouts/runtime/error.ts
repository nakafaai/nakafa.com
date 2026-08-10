import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { readConvexErrorData } from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

const runtimeFailureMessage = "Unable to complete try-out runtime operation.";

/** Expected failure while executing one try-out runtime capability. */
export class TryoutRuntimeError
  extends Schema.TaggedError<TryoutRuntimeError>()("TryoutRuntimeError", {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.String,
    message: Schema.String,
  })
  implements ConvexTaggedError {}

/** Maps an unknown runtime failure into the stable typed error channel. */
export function toTryoutRuntimeError(error: unknown) {
  if (error instanceof TryoutRuntimeError) {
    return error;
  }

  const data = readConvexErrorData(error);
  if (data) {
    return new TryoutRuntimeError({ ...data, cause: error });
  }

  return new TryoutRuntimeError({
    cause: error,
    code: "TRYOUT_RUNTIME_FAILED",
    message: runtimeFailureMessage,
  });
}

/** Lifts one Convex promise into the typed runtime error channel. */
export function tryRuntimePromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutRuntimeError, try: operation });
}
