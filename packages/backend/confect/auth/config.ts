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
      clientId: Config.schema(GoogleCredential, "GOOGLE_AUTH_CLIENT_ID"),
      clientSecret: Config.schema(
        Schema.Redacted(GoogleCredential),
        "GOOGLE_AUTH_CLIENT_SECRET"
      ),
    }).pipe(
      Effect.mapError(
        () =>
          new GoogleAuthConfigError({
            code: "AUTH_GOOGLE_CONFIG_INVALID",
            message:
              "GOOGLE_AUTH_CLIENT_ID and GOOGLE_AUTH_CLIENT_SECRET must be configured as nonempty credentials.",
          })
      )
    );
  }
);
