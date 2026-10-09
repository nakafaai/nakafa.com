import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { sha256Hex } from "@repo/utilities/digest";
import { Effect, Schema } from "effect";

/** Computes one SHA-256 identity through the Convex Web Crypto runtime. */
export const hashText = Effect.fn("contentRelease.hashText")(function* (
  label: string,
  source: string
) {
  const hex = yield* sha256Hex(source).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Unable to identify ${label}.`,
        })
    )
  );
  return yield* Schema.decodeEffect(Sha256HashSchema)(`sha256:${hex}`).pipe(
    Effect.orDie
  );
});
