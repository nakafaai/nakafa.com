import { Config, Effect, Schema } from "effect";

export class PolarEnvironmentError extends Schema.TaggedError<PolarEnvironmentError>()(
  "PolarEnvironmentError",
  { message: Schema.String }
) {}

/** Reads the Polar access token from the backend config boundary. */
export const readPolarAccessToken = Effect.fn("polar.readAccessToken")(
  function* () {
    return yield* Config.nonEmptyString("POLAR_ACCESS_TOKEN").pipe(
      Effect.mapError(
        () =>
          new PolarEnvironmentError({
            message:
              "Missing required Polar environment variable: POLAR_ACCESS_TOKEN",
          })
      )
    );
  }
);

/** Reads the active Polar server target from the public config boundary. */
export const readPolarServer = Effect.fn("polar.readServer")(function* () {
  const server = yield* Config.string("NEXT_PUBLIC_POLAR_SERVER").pipe(
    Config.withDefault("sandbox")
  );

  if (server === "production") {
    return "production";
  }

  if (server === "sandbox") {
    return "sandbox";
  }

  return yield* Effect.fail(
    new PolarEnvironmentError({
      message:
        "NEXT_PUBLIC_POLAR_SERVER must be either 'production' or 'sandbox'.",
    })
  );
});
