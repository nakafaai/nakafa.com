import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

/** Expected failure while deriving immutable identities for legacy IRT rows. */
export class IrtIdentityError
  extends Schema.TaggedError<IrtIdentityError>()("IrtIdentityError", {
    code: Schema.Literal("IRT_IDENTITY_MIGRATION"),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: "IRT_IDENTITY_MIGRATION";
  declare readonly message: string;
}

/** Fails one identity derivation with an operator-readable invariant. */
export function irtIdentityFail(message: string) {
  return Effect.fail(
    new IrtIdentityError({
      code: "IRT_IDENTITY_MIGRATION",
      message,
    })
  );
}
