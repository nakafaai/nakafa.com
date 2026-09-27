import { Config, Effect, Schema } from "effect";

const GoogleCredential = Schema.NonEmptyString.check(Schema.isTrimmed());

/** Google sign-in requires both configured credentials. */
export class GoogleAuthConfigError extends Schema.TaggedError<GoogleAuthConfigError>()(
  "GoogleAuthConfigError",
  {
    code: Schema.Literal("AUTH_GOOGLE_CONFIG_INVALID"),
    message: Schema.String,
  }
) {}

/** Keeps the Google secret redacted until Better Auth consumes it. */
export const readGoogleAuthConfig = Effect.fn("auth.readGoogleConfig")(
  function* () {
    return yield* Config.all({
      clientId: Config.schema(GoogleCredential, "AUTH_GOOGLE_ID"),
      clientSecret: Config.schema(
        Schema.Redacted(GoogleCredential),
        "AUTH_GOOGLE_SECRET"
      ),
    }).pipe(
      Effect.mapError(
        () =>
          new GoogleAuthConfigError({
            code: "AUTH_GOOGLE_CONFIG_INVALID",
            message:
              "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be configured as nonempty credentials.",
          })
      )
    );
  }
);
