// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Effect, Encoding, Schema } from "effect";

const NOW = 1_800_000_000_000;

/** Where the agent receives its code. */
const REDIRECT_URI = "https://agent.example/callback";

/** The PKCE verifier of the test's agent, and the challenge it sends (RFC 7636). */
const CODE_VERIFIER = "agent-verifier-agent-verifier-agent-verifier-0123";

/** The JSON body of an answer. */
const bodyOf = <S extends Schema.Top & { readonly DecodingServices: never }>(
  schema: S,
  response: Response
) =>
  Effect.promise(() => response.text()).pipe(
    Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(schema)))
  );

/** A token request as an agent sends it. */
const form = (fields: Readonly<Record<string, string>>) => ({
  body: new URLSearchParams(fields).toString(),
  headers: { "content-type": "application/x-www-form-urlencoded" },
  method: "POST",
});

const Registered = Schema.Struct({ client_id: Schema.String });
const Consent = Schema.Struct({ redirectURI: Schema.String });
const Tokens = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.Finite,
  refresh_token: Schema.String,
});

/** Registers an agent, and leads its person through the authorization up to the code. */
const authorizeAgent = Effect.gen(function* () {
  vi.setSystemTime(NOW);
  const t = createConvexTestWithBetterAuth();
  const person = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-person",
        suffix: "person",
      })
    )
  );
  const registered = yield* Effect.promise(() =>
    t.fetch("/api/auth/mcp/register", {
      body: JSON.stringify({
        client_name: "Test agent",
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "none",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  );
  const { client_id: clientId } = yield* bodyOf(Registered, registered);
  const challenge = yield* Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(CODE_VERIFIER))
  ).pipe(
    Effect.map((bytes) => Encoding.encodeBase64Url(new Uint8Array(bytes)))
  );
  const asked = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    state: "agent-state",
  });
  const authorized = yield* Effect.promise(() =>
    t.fetch(`/api/auth/mcp/authorize?${asked}`, {
      headers: { authorization: "Bearer session-person" },
      redirect: "manual",
    })
  );
  return { authorized, clientId, person, t };
});

describe("auth/grant", () => {
  it.effect("asks the person, then issues a Convex token of that person", () =>
    Effect.gen(function* () {
      const { authorized, clientId, person, t } = yield* authorizeAgent;
      const location = new URL(
        authorized.headers.get("location") ?? "",
        "https://nakafa.com"
      );
      // A registered client gets no code before its person answers.
      expect(location.pathname).toBe("/agent");
      const consentCode = location.searchParams.get("consent_code") ?? "";
      const client = yield* Effect.promise(() =>
        t.fetch(`/api/auth/agent/client?client_id=${clientId}`)
      );
      expect(yield* Effect.promise(() => client.json())).toEqual({
        name: "Test agent",
        redirect: "agent.example",
      });
      const answered = yield* Effect.promise(() =>
        t.fetch("/api/auth/oauth2/consent", {
          body: JSON.stringify({ accept: true, consent_code: consentCode }),
          headers: {
            authorization: "Bearer session-person",
            "content-type": "application/json",
          },
          method: "POST",
        })
      );
      const { redirectURI } = yield* bodyOf(Consent, answered);
      const code = new URL(redirectURI).searchParams.get("code") ?? "";
      const token = yield* Effect.promise(() =>
        t.fetch(
          "/api/auth/mcp/token",
          form({
            client_id: clientId,
            code,
            code_verifier: CODE_VERIFIER,
            grant_type: "authorization_code",
            redirect_uri: REDIRECT_URI,
          })
        )
      );
      const tokens = yield* bodyOf(Tokens, token);
      expect(tokens.expires_in).toBe(900);
      const [, payload = ""] = tokens.access_token.split(".");
      const text = yield* Encoding.decodeBase64UrlString(payload);
      const claims = yield* Schema.decodeEffect(
        Schema.fromJsonString(Schema.Struct({ sub: Schema.String }))
      )(text);
      expect(claims.sub).toBe(person.authUserId);
    })
  );
});
