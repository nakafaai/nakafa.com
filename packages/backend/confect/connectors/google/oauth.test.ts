import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  authorizationUrl,
  exchangeCode,
  pkcePair,
  refreshAccess,
  revokeGrant,
} from "@repo/backend/confect/connectors/google/oauth";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Redacted } from "effect";
import { Base64Url } from "effect/encoding";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

const client = {
  id: "client.apps.googleusercontent.com",
  secret: Redacted.make("test-secret"),
};

/** An ID token as Google's token endpoint answers it, whose payload names `sub`. */
const idToken = (claims: object) =>
  `header.${Base64Url.encode(new TextEncoder().encode(encodeJsonText(claims)))}.signature`;

/** One JSON answer of Google with a status. */
const answer = (status: number, body: object) =>
  new Response(encodeJsonText(body), {
    headers: { "content-type": "application/json" },
    status,
  });

/** Runs one Google call through the stubbed fetch. */
const google = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

describe("connectors/google/oauth", () => {
  beforeEach(() => {
    fetcher.mockReset();
  });

  it.effect(
    "makes a PKCE verifier whose challenge is its SHA-256, and a consent address with offline access and no other scope",
    () =>
      Effect.gen(function* () {
        const { challenge, verifier } = yield* pkcePair();
        expect(verifier).toHaveLength(43);
        const digest = yield* Effect.promise(() =>
          crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
        );
        expect(challenge).toBe(Base64Url.encode(new Uint8Array(digest)));
        const url = new URL(
          authorizationUrl({
            challenge,
            clientId: client.id,
            redirectUri: "https://nakafa.com/api/connectors/google/callback",
            scopes: ["openid", "https://www.googleapis.com/auth/drive.file"],
            state: "state-1",
          })
        );
        expect(url.origin + url.pathname).toBe(
          "https://accounts.google.com/o/oauth2/v2/auth"
        );
        expect(Object.fromEntries(url.searchParams)).toEqual({
          access_type: "offline",
          client_id: client.id,
          code_challenge: challenge,
          code_challenge_method: "S256",
          prompt: "consent",
          redirect_uri: "https://nakafa.com/api/connectors/google/callback",
          response_type: "code",
          scope: "openid https://www.googleapis.com/auth/drive.file",
          state: "state-1",
        });
      })
  );

  it.effect(
    "exchanges a code for the refresh token, the granted scopes, and the account's subject",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          answer(200, {
            access_token: "access",
            expires_in: 3599,
            id_token: idToken({ sub: "google-subject-1" }),
            refresh_token: "refresh",
            scope: "openid https://www.googleapis.com/auth/drive.file",
          })
        );
        const grant = yield* google(
          exchangeCode(client, {
            code: "code-1",
            redirectUri: "https://nakafa.com/api/connectors/google/callback",
            verifier: "verifier-1",
          })
        );
        expect(grant).toEqual({
          refreshToken: "refresh",
          scopes: ["openid", "https://www.googleapis.com/auth/drive.file"],
          subject: "google-subject-1",
        });
        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(String(url)).toBe("https://oauth2.googleapis.com/token");
        expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
          client_id: client.id,
          client_secret: "test-secret",
          code: "code-1",
          code_verifier: "verifier-1",
          grant_type: "authorization_code",
          redirect_uri: "https://nakafa.com/api/connectors/google/callback",
        });
      })
  );

  it.effect(
    "fails as invalid without a refresh token or with an ID token that does not decode, and as revoked, refused, or unreached",
    () =>
      Effect.gen(function* () {
        const exchange = () =>
          google(
            exchangeCode(client, {
              code: "code",
              redirectUri: "https://nakafa.com/x",
              verifier: "v",
            })
          ).pipe(Effect.flip);
        fetcher.mockResolvedValueOnce(
          answer(200, {
            access_token: "access",
            expires_in: 1,
            id_token: idToken({ sub: "s" }),
            scope: "openid",
          })
        );
        expect(yield* exchange()).toMatchObject({ reason: "invalid" });
        fetcher.mockResolvedValueOnce(
          answer(200, {
            access_token: "access",
            expires_in: 1,
            id_token: "only-one-part",
            refresh_token: "refresh",
            scope: "openid",
          })
        );
        expect(yield* exchange()).toMatchObject({ reason: "invalid" });
        fetcher.mockResolvedValueOnce(answer(200, { unexpected: true }));
        expect(yield* exchange()).toMatchObject({ reason: "invalid" });
        fetcher.mockResolvedValueOnce(answer(400, { error: "invalid_grant" }));
        expect(yield* exchange()).toMatchObject({
          reason: "revoked",
          status: 400,
        });
        fetcher.mockResolvedValueOnce(answer(500, { error: "server_error" }));
        expect(yield* exchange()).toMatchObject({
          reason: "refused",
          status: 500,
        });
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));
        expect(yield* exchange()).toMatchObject({ reason: "unreached" });
        fetcher.mockResolvedValueOnce(
          new Response(
            new ReadableStream({
              start: (controller) => controller.error(new Error("cut")),
            }),
            { status: 200 }
          )
        );
        expect(yield* exchange()).toMatchObject({ reason: "unreached" });
      })
  );

  it.effect(
    "refreshes an access token, and revokes a grant once, treating one Google no longer knows as gone",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          answer(200, { access_token: "fresh", expires_in: 3599, scope: "" })
        );
        expect(yield* google(refreshAccess(client, "refresh"))).toBe("fresh");
        fetcher.mockResolvedValueOnce(new Response(null, { status: 200 }));
        expect(yield* google(revokeGrant("refresh"))).toBe("revoked");
        fetcher.mockResolvedValueOnce(new Response(null, { status: 400 }));
        expect(yield* google(revokeGrant("refresh"))).toBe("gone");
        fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
        expect(
          yield* google(revokeGrant("refresh")).pipe(Effect.flip)
        ).toMatchObject({ reason: "refused", status: 503 });
      })
  );
});
