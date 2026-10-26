import { LOCAL_AUTH_SECRET } from "@repo/backend/scripts/content/acceptance/auth";
import { FetchClient } from "@repo/utilities/http/client";
import { makeSignature } from "better-auth/crypto";
import { Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

/** A seat whose Convex token the local backend did not issue. */
export class TokenFailed extends Schema.TaggedError<TokenFailed>()(
  "TokenFailed",
  { status: Schema.Int }
) {}

/** Better Auth's session cookie under its default name on plain HTTP. */
const SESSION_COOKIE = "better-auth.session_token";

/** The route of Better Auth's Convex plugin that issues a Convex token for a session. */
const TOKEN_PATH = "/api/auth/convex/token";

/** What Better Auth's Convex plugin answers: the signed token that Convex verifies. */
const IssuedToken = Schema.Struct({ token: Schema.String });

/**
 * The session cookie of one seat's session token, signed with the local runtime's inert
 * secret, as a browser holds it. Better Auth signs its cookie with HMAC-SHA256, which
 * Effect's Crypto does not provide, so Better Auth's own signature function signs it.
 */
export const sessionCookie = Effect.fn("load.token.cookie")(function* (
  sessionToken: string
) {
  const signature = yield* Effect.promise(() =>
    makeSignature(sessionToken, LOCAL_AUTH_SECRET)
  );
  return `${SESSION_COOKIE}=${encodeURIComponent(`${sessionToken}.${signature}`)}`;
});

/**
 * Asks the Convex site at `site` for a seat's Convex token with its session cookie, through
 * the route that the app's own token request reaches. The token expires, and the Convex
 * client asks again through this request before it does.
 */
export const issueToken = Effect.fn("load.token.issue")(
  function* (site: string, cookie: string) {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    const response = yield* client
      .execute(
        HttpClientRequest.get(new URL(TOKEN_PATH, site).href).pipe(
          HttpClientRequest.setHeader("cookie", cookie),
          HttpClientRequest.acceptJson
        )
      )
      .pipe(Effect.mapError(() => new TokenFailed({ status: 0 })));
    if (response.status !== 200) {
      return yield* new TokenFailed({ status: response.status });
    }
    const issued = yield* HttpClientResponse.schemaBodyJson(IssuedToken)(
      response
    ).pipe(Effect.mapError(() => new TokenFailed({ status: response.status })));
    return issued.token;
  },
  Effect.scoped,
  Effect.provide(FetchClient)
);
