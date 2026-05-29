import { Config, Effect, Schema } from "effect";

export class PolarWebhookEnvironmentError extends Schema.TaggedError<PolarWebhookEnvironmentError>()(
  "PolarWebhookEnvironmentError",
  { message: Schema.String }
) {}

/** Reads the Polar webhook secret from the HTTP adapter env boundary. */
export const readPolarWebhookSecret = Effect.fnUntraced(function* () {
  return yield* Config.nonEmptyString("POLAR_WEBHOOK_SECRET").pipe(
    Effect.mapError(
      () =>
        new PolarWebhookEnvironmentError({
          message:
            "Missing required Polar environment variable: POLAR_WEBHOOK_SECRET",
        })
    )
  );
});
