import { PublicationFailureCodeSchema } from "@nakafa/aksara-contracts/transport/failure";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect, Either, Schema } from "effect";

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
  const decoded = Schema.decodeUnknownEither(ConvexFailureSchema)(cause);
  if (Either.isLeft(decoded)) {
    return null;
  }
  return new ReleaseError(decoded.right.data);
}

/** Invokes one internal Convex capability without sanitizing unknown defects. */
export function callInternal<A>(invoke: () => Promise<A>) {
  return Effect.tryPromise({ catch: (cause) => cause, try: invoke }).pipe(
    Effect.catchAll((cause) => {
      const expected = decodeExpectedFailure(cause);
      return expected ? Effect.fail(expected) : Effect.die(cause);
    })
  );
}
