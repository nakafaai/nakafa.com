import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Option, Ref, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

/** A seat that Convex Auth did not sign in, or whose session it did not refresh. */
export class TokenFailed extends Schema.TaggedError<
  TokenFailed,
  { readonly brand: unique symbol }
>()("TokenFailed", { status: Schema.Int }) {}

/** The tokens of one Convex Auth session. */
const SessionTokens = Schema.Struct({
  accessToken: Schema.String,
  refreshToken: Schema.String,
});

/** What the password sign-in answers when it made a session. */
const SignedIn = Schema.Struct({
  status: Schema.Literal("success"),
  value: Schema.Struct({
    status: Schema.Literal("complete"),
    tokens: SessionTokens,
  }),
});

/** What a refresh answers: new tokens, or no session, which the seat reads as signed out. */
const Refreshed = Schema.Struct({
  status: Schema.Literal("success"),
  value: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("rotated"), tokens: SessionTokens }),
    Schema.Struct({ kind: Schema.Literal("noSession") }),
  ]),
});

/**
 * Calls one public mutation through the deployment's HTTP API, as a browser's
 * sign-in route does, and decodes its answer.
 * https://docs.convex.dev/http-api/
 */
const mutate = Effect.fn("load.token.mutate")(
  function* <A, I>(
    address: string,
    path: string,
    args: Readonly<Record<string, string>>,
    answer: Schema.Codec<A, I>
  ) {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    const request = yield* HttpClientRequest.post(
      new URL("/api/mutation", address).href
    ).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.bodyJson({ args, format: "json", path })
    );
    const response = yield* client
      .execute(request)
      .pipe(Effect.mapError(() => new TokenFailed({ status: 0 })));
    if (response.status !== 200) {
      return yield* new TokenFailed({ status: response.status });
    }
    return yield* HttpClientResponse.schemaBodyJson(answer)(response).pipe(
      Effect.mapError(() => new TokenFailed({ status: response.status }))
    );
  },
  Effect.scoped,
  Effect.provide(FetchClient)
);

/** One ask of a seat's token: a sign-in on the first ask, and a refresh of that session on every later one. */
const askToken = Effect.fn("load.token.ask")(function* (
  address: string,
  seat: { readonly token: string; readonly userId: string },
  refresh: Ref.Ref<Option.Option<string>>
) {
  const held = yield* Ref.get(refresh);
  if (Option.isNone(held)) {
    const signed = yield* mutate(
      address,
      "auth/core:signInWithUsernamePassword",
      { password: seat.token, username: seat.userId },
      SignedIn
    );
    yield* Ref.set(refresh, Option.some(signed.value.tokens.refreshToken));
    return signed.value.tokens.accessToken;
  }
  const refreshed = yield* mutate(
    address,
    "auth/core:refreshSession",
    { refreshToken: held.value },
    Refreshed
  );
  if (refreshed.value.kind === "noSession") {
    return null;
  }
  yield* Ref.set(refresh, Option.some(refreshed.value.tokens.refreshToken));
  return refreshed.value.tokens.accessToken;
});

/**
 * The access-token source of one seat's browser: the first ask signs the seat
 * in with Convex Auth's password method, its account id and its token, and
 * every later ask refreshes that session, as a signed-in tab does. A session
 * that is gone answers no token.
 */
export const seatTokens = (
  address: string,
  seat: { readonly token: string; readonly userId: string }
) =>
  Ref.make(Option.none<string>()).pipe(
    Effect.map((refresh) => askToken(address, seat, refresh))
  );
