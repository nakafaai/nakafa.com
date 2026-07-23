import { PublicationFailureCodeSchema } from "@nakafa/aksara-contracts/transport/failure";
import { Effect, Schema } from "effect";

/** Typed publication failure translated at the native Convex boundary. */
export class ReleaseError extends Schema.TaggedError<ReleaseError>()(
  "ReleaseError",
  {
    code: PublicationFailureCodeSchema,
    message: Schema.String,
  }
) {}

/** Fails one domain program with a stable publication code. */
export function releaseFail(code: ReleaseError["code"], message: string) {
  return Effect.fail(new ReleaseError({ code, message }));
}
