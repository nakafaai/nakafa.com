import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import {
  getUnknownErrorMessage,
  readConvexErrorData,
} from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

/** Expected failure while executing one try-out runtime capability. */
export class TryoutRuntimeError
  extends Schema.TaggedError<TryoutRuntimeError>()("TryoutRuntimeError", {
    code: Schema.String,
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: string;
  declare readonly message: string;
}

/** Maps an unknown runtime failure into the stable typed error channel. */
export function toTryoutRuntimeError(error: unknown) {
  if (error instanceof TryoutRuntimeError) {
    return error;
  }

  const data = readConvexErrorData(error);
  if (data) {
    return new TryoutRuntimeError(data);
  }

  return new TryoutRuntimeError({
    code: "TRYOUT_RUNTIME_FAILED",
    message: getUnknownErrorMessage(error),
  });
}

/** Lifts one Convex promise into the typed runtime error channel. */
export function tryRuntimePromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutRuntimeError, try: operation });
}

/** Lifts one synchronous runtime operation into the typed error channel. */
export function tryRuntimeSync<A>(operation: () => A) {
  return Effect.try({ catch: toTryoutRuntimeError, try: operation });
}
