import { ConvexHttpClient } from "convex/browser";
import { type FunctionReference, makeFunctionReference } from "convex/server";
import {
  Array as Arr,
  Effect,
  Option,
  Predicate,
  Record,
  Schema,
} from "effect";
import { CONVEX_URL } from "@/lib/server/runtime";

/** Nakafa's agent OAuth functions (`auth/grant`), for which these endpoints speak OAuth (ADR 0029). */
const register: FunctionReference<"mutation"> = makeFunctionReference(
  "auth/grant:register"
);
const exchange: FunctionReference<"mutation"> = makeFunctionReference(
  "auth/grant:exchange"
);
const refresh: FunctionReference<"mutation"> = makeFunctionReference(
  "auth/grant:refresh"
);

/** A dynamic client registration request (RFC 7591), of the fields Nakafa reads. */
const RegistrationRequest = Schema.Struct({
  client_name: Schema.optionalKey(Schema.String),
  redirect_uris: Schema.Array(Schema.String),
});

/** A token request (RFC 6749 sections 4.1.3 and 6). */
const TokenRequest = Schema.Union([
  Schema.Struct({
    client_id: Schema.String,
    code: Schema.String,
    code_verifier: Schema.String,
    grant_type: Schema.Literal("authorization_code"),
    redirect_uri: Schema.String,
  }),
  Schema.Struct({
    client_id: Schema.String,
    grant_type: Schema.Literal("refresh_token"),
    refresh_token: Schema.String,
  }),
]);

/** A refusal that `auth/grant` raised, as the error data Convex returns. */
const Refusal = Schema.Struct({
  error: Schema.String,
  error_description: Schema.String,
});

/** What a registration answers. */
const Registered = Schema.Struct({ clientId: Schema.String });

/** What a token exchange or refresh answers. */
const Exchange = Schema.Union([
  Schema.Struct({
    outcome: Schema.Literal("issued"),
    tokens: Schema.Record(Schema.String, Schema.Unknown),
  }),
  Schema.Struct({
    outcome: Schema.Literal("refused"),
    error: Schema.String,
    error_description: Schema.String,
  }),
]);

/** OAuth's JSON answer, never cached (RFC 6749 section 5.1). */
const oauthAnswer = (body: unknown, status: number) =>
  Response.json(body, {
    headers: { "cache-control": "no-store", pragma: "no-cache" },
    status,
  });

/**
 * The fields of a request's body: JSON, as a registration sends it, or a form,
 * as a token request does (RFC 6749 section 4.1.3). None when it is neither.
 */
const readFields = Effect.fn("www.agent.fields")(function* (request: Request) {
  const text = yield* Effect.promise(() => request.text());
  if ((request.headers.get("content-type") ?? "").includes("json")) {
    return Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(
      text
    );
  }
  return Option.some(
    Record.fromEntries(Arr.fromIterable(new URLSearchParams(text)))
  );
});

/** The refusal that a failed agent call carries, if it is one. */
const refusalOf = (cause: unknown) =>
  Predicate.hasProperty(cause, "data")
    ? Schema.decodeUnknownOption(Refusal)(cause.data)
    : Option.none();

/**
 * Registers an agent (RFC 7591): a public client that proves itself with PKCE
 * (ADR 0029). The answer names its `client_id` and what it registered.
 */
export const registerAgent = Effect.fn("www.agent.register")(function* (
  request: Request
) {
  const body = Option.flatMap(
    yield* readFields(request),
    Schema.decodeUnknownOption(RegistrationRequest)
  );
  if (Option.isNone(body)) {
    return oauthAnswer(
      {
        error: "invalid_client_metadata",
        error_description: "Send redirect_uris as JSON.",
      },
      400
    );
  }
  const name = body.value.client_name ?? "Agent";
  const client = new ConvexHttpClient(yield* CONVEX_URL);
  const answer = yield* Effect.tryPromise({
    catch: (cause) => cause,
    try: () =>
      client.mutation(register, {
        name,
        redirectUris: body.value.redirect_uris,
      }),
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Registered)), Effect.result);
  if (answer._tag === "Failure") {
    const refusal = refusalOf(answer.failure);
    if (Option.isNone(refusal)) {
      return yield* Effect.die(answer.failure);
    }
    return oauthAnswer(
      refusal.value,
      refusal.value.error === "slow_down" ? 429 : 400
    );
  }
  return oauthAnswer(
    {
      client_id: answer.success.clientId,
      client_name: name,
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: body.value.redirect_uris,
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201
  );
});

/** Trades a code or a refresh token for an agent's tokens (RFC 6749 section 5). */
export const issueAgentTokens = Effect.fn("www.agent.token")(function* (
  request: Request
) {
  const body = Option.flatMap(
    yield* readFields(request),
    Schema.decodeUnknownOption(TokenRequest)
  );
  if (Option.isNone(body)) {
    return oauthAnswer(
      {
        error: "invalid_request",
        error_description: "Send a supported grant_type with its fields.",
      },
      400
    );
  }
  const grant = body.value;
  const client = new ConvexHttpClient(yield* CONVEX_URL);
  const answer = yield* Effect.tryPromise({
    catch: (cause) => cause,
    try: () =>
      grant.grant_type === "authorization_code"
        ? client.mutation(exchange, {
            clientId: grant.client_id,
            code: grant.code,
            codeVerifier: grant.code_verifier,
            redirectUri: grant.redirect_uri,
          })
        : client.mutation(refresh, {
            clientId: grant.client_id,
            refreshToken: grant.refresh_token,
          }),
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Exchange)), Effect.result);
  if (answer._tag === "Failure") {
    const refusal = refusalOf(answer.failure);
    if (Option.isNone(refusal)) {
      return yield* Effect.die(answer.failure);
    }
    return oauthAnswer(refusal.value, 401);
  }
  return answer.success.outcome === "issued"
    ? oauthAnswer(answer.success.tokens, 200)
    : oauthAnswer(
        {
          error: answer.success.error,
          error_description: answer.success.error_description,
        },
        400
      );
});
