// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { registrations } from "@repo/backend/confect/auth/grant";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Schema } from "effect";
import { Base64Url } from "effect/encoding";

const NOW = 1_800_000_000_000;

/** Where the agent receives its code. */
const REDIRECT_URI = "https://agent.example/callback";

/** The PKCE verifier of the test's agent, and the challenge it sends (RFC 7636). */
const CODE_VERIFIER = "agent-verifier-agent-verifier-agent-verifier-0123";

/** The JSON body of an answer. */
const jsonOf = (response: Response) =>
  Effect.promise(() => response.text()).pipe(
    Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown)))
  );

/** A token request as an agent sends it. */
const form = (fields: Readonly<Record<string, string>>) => ({
  body: new URLSearchParams(fields).toString(),
  headers: { "content-type": "application/x-www-form-urlencoded" },
  method: "POST",
});

/** The person's own sign-in, as the bearer plugin reads it. */
const SIGNED_IN = "Bearer session-person";

const SIGNED_IN_JSON = {
  authorization: SIGNED_IN,
  "content-type": "application/json",
};

const Agents = Schema.Array(
  Schema.Struct({
    clientId: Schema.String,
    name: Schema.NullOr(Schema.String),
  })
);
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
      body: encodeJsonText({
        client_name: "Test agent",
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "none",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  );
  const { client_id: clientId } = yield* jsonOf(registered).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Registered))
  );
  const challenge = yield* Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(CODE_VERIFIER))
  ).pipe(Effect.map((bytes) => Base64Url.encode(new Uint8Array(bytes))));
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
      headers: { authorization: SIGNED_IN },
      redirect: "manual",
    })
  );
  return { authorized, clientId, person, t };
});

/** Answers the consent of one authorization as the person. */
const answerConsent = (
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  authorized: Response,
  accept: boolean
) =>
  Effect.gen(function* () {
    const location = new URL(
      authorized.headers.get("location") ?? "",
      "https://nakafa.com"
    );
    const answered = yield* Effect.promise(() =>
      t.fetch("/api/auth/oauth2/consent", {
        body: encodeJsonText({
          accept,
          consent_code: location.searchParams.get("consent_code"),
        }),
        headers: SIGNED_IN_JSON,
        method: "POST",
      })
    );
    const { redirectURI } = yield* jsonOf(answered).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Consent))
    );
    return new URL(redirectURI);
  });

/** Trades a person's yes for the agent's first tokens. */
const signIn = Effect.gen(function* () {
  const { authorized, clientId, person, t } = yield* authorizeAgent;
  const redirect = yield* answerConsent(t, authorized, true);
  const response = yield* Effect.promise(() =>
    t.fetch(
      "/api/auth/mcp/token",
      form({
        client_id: clientId,
        code: redirect.searchParams.get("code") ?? "",
        code_verifier: CODE_VERIFIER,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      })
    )
  );
  const tokens = yield* jsonOf(response).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Tokens))
  );
  return { clientId, person, t, tokens };
});

describe("auth/grant", () => {
  it.effect("asks the person, then issues a Convex token of that person", () =>
    Effect.gen(function* () {
      const { authorized, clientId, t } = yield* authorizeAgent;
      // A registered client gets no code before its person answers.
      expect(
        new URL(authorized.headers.get("location") ?? "", "https://nakafa.com")
          .pathname
      ).toBe("/agent");
      const client = yield* Effect.promise(() =>
        t.fetch(`/api/auth/agent/client?client_id=${clientId}`)
      );
      expect(yield* Effect.promise(() => client.json())).toEqual({
        name: "Test agent",
        redirect: "agent.example",
      });
      const denied = yield* answerConsent(t, authorized, false);
      expect(denied.searchParams.has("code")).toBe(false);
    })
  );

  it.effect("signs the agent in as its person, once per refresh token", () =>
    Effect.gen(function* () {
      const { clientId, person, t, tokens } = yield* signIn;
      expect(tokens.expires_in).toBe(900);
      const [, payload = ""] = tokens.access_token.split(".");
      const text = yield* Base64Url.decodeString(payload);
      const claims = yield* Schema.decodeEffect(
        Schema.fromJsonString(Schema.Struct({ sub: Schema.String }))
      )(text);
      expect(claims.sub).toBe(person.authUserId);
      const refresh = form({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      });
      const renewed = yield* Effect.promise(() =>
        t.fetch("/api/auth/mcp/token", refresh)
      );
      expect(
        (yield* jsonOf(renewed).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Tokens))
        )).expires_in
      ).toBe(900);
      const replayed = yield* Effect.promise(() =>
        t.fetch("/api/auth/mcp/token", refresh)
      );
      expect(replayed.status).toBe(401);
    })
  );

  it.effect("lists the agents a person let in, and ends one", () =>
    Effect.gen(function* () {
      const { clientId, t, tokens } = yield* signIn;
      const list = () =>
        Effect.promise(() =>
          t.fetch("/api/auth/agent/list", {
            headers: { authorization: SIGNED_IN },
          })
        ).pipe(
          Effect.flatMap(jsonOf),
          Effect.flatMap(Schema.decodeUnknownEffect(Agents))
        );
      expect(yield* list()).toEqual([{ clientId, name: "Test agent" }]);
      const revoked = yield* Effect.promise(() =>
        t.fetch("/api/auth/agent/revoke", {
          body: encodeJsonText({ client_id: clientId }),
          headers: SIGNED_IN_JSON,
          method: "POST",
        })
      );
      expect(revoked.status).toBe(200);
      expect(yield* list()).toEqual([]);
      const refused = yield* Effect.promise(() =>
        t.fetch(
          "/api/auth/mcp/token",
          form({
            client_id: clientId,
            grant_type: "refresh_token",
            refresh_token: tokens.refresh_token,
          })
        )
      );
      expect(refused.status).toBe(401);
    })
  );

  it.effect("names no agent for an unknown client", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const client = yield* Effect.promise(() =>
        t.fetch("/api/auth/agent/client?client_id=unknown")
      );
      expect(yield* Effect.promise(() => client.json())).toEqual({
        name: null,
        redirect: null,
      });
    })
  );

  it.effect("refuses a registration past the limit", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() =>
        t.action((ctx) =>
          registrations.limit(ctx, "agentRegistration", { count: 20 })
        )
      );
      const refused = yield* Effect.promise(() =>
        t.fetch("/api/auth/mcp/register", {
          body: encodeJsonText({ redirect_uris: [REDIRECT_URI] }),
          headers: { "content-type": "application/json" },
          method: "POST",
        })
      );
      expect(refused.status).toBe(429);
    })
  );
});
