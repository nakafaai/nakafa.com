import { Effect, Schema } from "effect";

const socialSignInFailedCode = "SOCIAL_SIGN_IN_FAILED";

export interface SocialSignInResult {
  readonly data?: unknown;
  readonly error?: unknown;
}

export type SocialSignInRequest = (input: {
  readonly callbackURL: string;
  readonly errorCallbackURL: string;
  readonly provider: "google";
}) => Promise<SocialSignInResult>;

/** Raised when the social sign-in request cannot start safely. */
export class SocialSignInFailed extends Schema.TaggedError<SocialSignInFailed>()(
  "SocialSignInFailed",
  {
    code: Schema.Literal(socialSignInFailedCode),
  }
) {}

/** Starts Google auth and keeps transport/provider failures typed. */
export const startGoogleSignIn = Effect.fn("www.auth.startGoogleSignIn")(
  function* (
    input: {
      readonly callbackURL: string;
      readonly errorCallbackURL: string;
    },
    request: SocialSignInRequest
  ) {
    const result = yield* Effect.tryPromise({
      catch: () =>
        new SocialSignInFailed({
          code: socialSignInFailedCode,
        }),
      try: () => request({ ...input, provider: "google" }),
    });

    if (result.error) {
      return yield* new SocialSignInFailed({
        code: socialSignInFailedCode,
      });
    }
  }
);
