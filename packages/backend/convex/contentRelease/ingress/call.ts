import { PublicationFailureCodeSchema } from "@nakafa/aksara-contracts/transport/failure";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect, Result, Schema } from "effect";

const ConvexFailureSchema = Schema.Struct({
  data: Schema.Struct({
    code: PublicationFailureCodeSchema,
    message: Schema.String,
  }),
});
/** Recovers only the stable expected error payload emitted by our handlers. */
function decodeExpectedFailure(cause: unknown) {
  if (cause instanceof ReleaseError) {
    return cause;
  }
  const decoded = Schema.decodeUnknownResult(ConvexFailureSchema)(cause);
  if (Result.isFailure(decoded)) {
    return null;
  }
  return new ReleaseError(decoded.success.data);
}
/** Invokes one internal Convex capability without sanitizing unknown defects. */
export function callInternal<A>(invoke: () => Promise<A>) {
  return Effect.tryPromise(invoke).pipe(
    Effect.catchTag("UnknownError", (error) => {
      const expected = decodeExpectedFailure(error.cause);
      return expected ? Effect.fail(expected) : Effect.die(error.cause);
    })
  );
}
