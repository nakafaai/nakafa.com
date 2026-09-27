import { PolarCore } from "@polar-sh/sdk/core";
import { Config, Effect, Redacted, Schema } from "effect";

/** Missing deployment configuration required for a Polar request. */
class PolarConfigError extends Schema.TaggedError<PolarConfigError>()(
  "PolarConfigError",
  { message: Schema.String }
) {}

/** Creates the SDK client only when a billing operation needs it. */
export const readPolarClient = Effect.fn("polar.readClient")(function* () {
  const accessToken = yield* Config.schema(
    Schema.Redacted(Schema.NonEmptyString),
    "POLAR_ACCESS_TOKEN"
  ).pipe(
    Effect.mapError(
      () =>
        new PolarConfigError({
          message: "Missing required Polar access token.",
        })
    )
  );
  const server = yield* Config.schema(
    Schema.Literals(["production", "sandbox"]),
    "NEXT_PUBLIC_POLAR_SERVER"
  ).pipe(
    Config.withDefault("sandbox"),
    Effect.mapError(
      () =>
        new PolarConfigError({
          message: "Unable to read the Polar deployment environment.",
        })
    )
  );
  return yield* Effect.sync(
    () =>
      new PolarCore({
        accessToken: Redacted.value(accessToken),
        server,
      })
  );
});
