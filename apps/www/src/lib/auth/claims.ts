import { Array as Arr, Option, Result, Schema, String as Str } from "effect";
import { Base64Url } from "effect/encoding";

/**
 * The claims of a Convex token that name its session. Better Auth's Convex plugin
 * signs the user's fields, the session ID and the expiry, in seconds, with the
 * user ID as the subject.
 */
const TokenClaims = Schema.fromJsonString(
  Schema.Struct({
    exp: Schema.Finite,
    name: Schema.String,
    sessionId: Schema.String,
    sub: Schema.String,
  })
);

/**
 * The claims a Convex token carries, read from its payload and not verified:
 * Convex verifies the token on every read, so a reader only learns from them which
 * session the token names. None when the text is not such a token.
 */
export const readTokenClaims = (token: string) =>
  Arr.get(Str.split(token, "."), 1).pipe(
    Option.flatMap((payload) =>
      Result.getSuccess(Base64Url.decodeString(payload))
    ),
    Option.flatMap(Schema.decodeOption(TokenClaims))
  );
