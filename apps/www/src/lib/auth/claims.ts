import { Array as Arr, Option, Result, Schema, String as Str } from "effect";
import { Base64Url } from "effect/encoding";

/**
 * The claims of a Convex Auth access token that a reader uses: its subject,
 * which is the session it names, and its expiry, in seconds.
 * https://docs.convex.dev/auth/convex-auth/best-practices
 */
const TokenClaims = Schema.fromJsonString(
  Schema.Struct({
    exp: Schema.Finite,
    sub: Schema.String,
  })
);

/**
 * The claims an access token carries, read from its payload and not verified:
 * Convex verifies the token on every call, so a reader only learns from them
 * which session the token names. None when the text is not such a token.
 */
export const readTokenClaims = (token: string) =>
  Arr.get(Str.split(token, "."), 1).pipe(
    Option.flatMap((payload) =>
      Result.getSuccess(Base64Url.decodeString(payload))
    ),
    Option.flatMap(Schema.decodeOption(TokenClaims))
  );
