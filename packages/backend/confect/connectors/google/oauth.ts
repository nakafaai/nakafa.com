import { GoogleFailed } from "@repo/backend/confect/connectors/errors";
import { sha256 } from "@repo/utilities/digest";
import {
  Array as Arr,
  Duration,
  Effect,
  Option,
  Redacted,
  Schema,
} from "effect";
import { SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";
import {
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";

/** Google's authorization, token, and revocation endpoints, from its OpenID configuration. */
const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

/** How long Nakafa waits for one answer of Google (ADR 0020). */
export const GOOGLE_DEADLINE = Duration.seconds(10);

/** The random bytes of a PKCE verifier and of a state: 32, which Base64Url makes 43 characters. */
const RANDOM_BYTES = 32;

/** The OAuth client of the connectors project: its ID, and its secret, which never leaves the server. */
const GoogleClient = Schema.Struct({
  id: Schema.NonEmptyString,
  secret: Schema.Redacted(Schema.NonEmptyString),
});

/** The OAuth client of the connectors project. */
type GoogleClient = typeof GoogleClient.Type;

/** What Google's token endpoint answers. A code exchange carries the refresh token and the ID token; a refresh carries neither. */
const TokenAnswer = Schema.Struct({
  access_token: Schema.NonEmptyString,
  expires_in: Schema.Finite,
  id_token: Schema.optionalKey(Schema.NonEmptyString),
  refresh_token: Schema.optionalKey(Schema.NonEmptyString),
  scope: Schema.String,
});

/** The claims of an ID token that a connection reads: the subject of the Google account. */
const IdClaims = Schema.fromJsonString(
  Schema.Struct({ sub: Schema.NonEmptyString })
);

/** What Google's token endpoint answers when it refuses, as RFC 6749 names it. */
const TokenRefusal = Schema.fromJsonString(
  Schema.Struct({ error: Schema.String })
);

/**
 * A new PKCE pair, method S256 (RFC 7636): a verifier of 43 random characters and
 * its challenge, the Base64Url of its SHA-256. The verifier stays on the server
 * until the code is exchanged.
 */
export const pkcePair = Effect.fn("connectors.google.pkce")(function* () {
  const random = yield* SecureRandom.SecureRandom;
  const verifier = Base64Url.encode(yield* random.randomBytes(RANDOM_BYTES));
  const challenge = Base64Url.encode(
    yield* sha256(new TextEncoder().encode(verifier))
  );
  return { challenge, verifier };
}, Effect.provide(SecureRandom.layerWebCrypto));

/** A new state of one connect: 43 random characters that the callback brings back. */
export const newState = Effect.fn("connectors.google.state")(function* () {
  return Base64Url.encode(
    yield* (yield* SecureRandom.SecureRandom).randomBytes(RANDOM_BYTES)
  );
}, Effect.provide(SecureRandom.layerWebCrypto));

/**
 * The address that sends the user to Google's consent screen for one connection:
 * the authorization code flow with PKCE, offline access so that Google gives a
 * refresh token, and consent asked each time so that it always does. No
 * `include_granted_scopes` is sent, so the token covers this connection's scopes
 * alone (ADR 0015).
 */
export const authorizationUrl = (request: {
  readonly challenge: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly state: string;
}) => {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    access_type: "offline",
    client_id: request.clientId,
    code_challenge: request.challenge,
    code_challenge_method: "S256",
    prompt: "consent",
    redirect_uri: request.redirectUri,
    response_type: "code",
    scope: Arr.join(request.scopes, " "),
    state: request.state,
  }).toString();
  return url.href;
};

/**
 * Posts one form to a Google OAuth endpoint and answers the response. No answer
 * within the deadline fails as `unreached`.
 */
const postForm = (endpoint: string, form: Record<string, string>) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    return yield* client
      .execute(
        HttpClientRequest.post(endpoint).pipe(
          HttpClientRequest.bodyUrlParams(form)
        )
      )
      .pipe(
        Effect.timeout(GOOGLE_DEADLINE),
        Effect.mapError(() => new GoogleFailed({ reason: "unreached" }))
      );
  });

/**
 * Reads the token endpoint's answer. Google answers `invalid_grant` for a code
 * or a refresh token that it no longer accepts, which `revoked` names, so a
 * connection whose grant was taken back waits for its owner to connect again.
 */
const tokenAnswer = Effect.fn("connectors.google.tokenAnswer")(function* (
  response: HttpClientResponse.HttpClientResponse
) {
  const text = yield* response.text.pipe(
    Effect.mapError(() => new GoogleFailed({ reason: "unreached" }))
  );
  if (response.status < 200 || response.status >= 300) {
    const revoked = Option.exists(
      Schema.decodeOption(TokenRefusal)(text),
      (refusal) => refusal.error === "invalid_grant"
    );
    return yield* new GoogleFailed({
      reason: revoked ? "revoked" : "refused",
      status: response.status,
    });
  }
  return yield* Schema.decodeEffect(Schema.fromJsonString(TokenAnswer))(
    text
  ).pipe(Effect.mapError(() => new GoogleFailed({ reason: "invalid" })));
});

/**
 * The subject of the Google account in an ID token. The token comes straight from
 * Google's token endpoint over TLS, which OpenID Connect Core (3.1.3.7) accepts in
 * place of checking its signature.
 */
const subjectOf = Effect.fn("connectors.google.subject")(
  function* (idToken: string) {
    const payload = yield* Effect.fromOption(Arr.get(idToken.split("."), 1));
    const bytes = yield* Effect.fromResult(Base64Url.decode(payload));
    const claims = yield* Schema.decodeEffect(IdClaims)(
      new TextDecoder().decode(bytes)
    );
    return claims.sub;
  },
  Effect.mapError(() => new GoogleFailed({ reason: "invalid" }))
);

/**
 * Exchanges the code of a finished consent for the connection's refresh token and
 * the subject of its Google account. An answer without either fails as `invalid`,
 * so no connection is made without a token that lasts.
 */
export const exchangeCode = Effect.fn("connectors.google.exchange")(function* (
  client: GoogleClient,
  grant: {
    readonly code: string;
    readonly redirectUri: string;
    readonly verifier: string;
  }
) {
  const answer = yield* tokenAnswer(
    yield* postForm(TOKEN_ENDPOINT, {
      client_id: client.id,
      client_secret: Redacted.value(client.secret),
      code: grant.code,
      code_verifier: grant.verifier,
      grant_type: "authorization_code",
      redirect_uri: grant.redirectUri,
    })
  );
  if (answer.refresh_token === undefined || answer.id_token === undefined) {
    return yield* new GoogleFailed({ reason: "invalid" });
  }
  return {
    refreshToken: answer.refresh_token,
    scopes: Arr.filter(answer.scope.split(" "), (scope) => scope !== ""),
    subject: yield* subjectOf(answer.id_token),
  };
}, Effect.scoped);

/** A new access token for one connection, from its refresh token. It lasts about an hour and is never stored. */
export const refreshAccess = Effect.fn("connectors.google.refresh")(function* (
  client: GoogleClient,
  refreshToken: string
) {
  const answer = yield* tokenAnswer(
    yield* postForm(TOKEN_ENDPOINT, {
      client_id: client.id,
      client_secret: Redacted.value(client.secret),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
  return answer.access_token;
}, Effect.scoped);

/**
 * Revokes a grant at Google. Google ends every scope that the account granted the
 * connectors project, which is why only the last connection of an account calls
 * it (ADR 0015). A token that Google no longer knows is already revoked.
 */
export const revokeGrant = Effect.fn("connectors.google.revoke")(function* (
  refreshToken: string
) {
  const response = yield* postForm(REVOKE_ENDPOINT, { token: refreshToken });
  if (response.status === 400) {
    return "gone" as const;
  }
  if (response.status < 200 || response.status >= 300) {
    return yield* new GoogleFailed({
      reason: "refused",
      status: response.status,
    });
  }
  return "revoked" as const;
}, Effect.scoped);
