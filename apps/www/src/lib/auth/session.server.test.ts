// @vitest-environment node
import { AUTH_JWT_COOKIE, AUTH_REFRESH_COOKIE } from "@convex-dev/auth/ssr";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import {
  readRequestSession,
  SessionUnavailable,
} from "@/lib/auth/session.server";

const CONVEX_URL = "https://example.convex.cloud";
const PREFIX = "nakafa-dev.";

/** The deployment's answers, one double for the file (AGENTS.md). */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

/** The JSON text of one body. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** An access token for `sub` that expires `exp` seconds after the epoch. */
const tokenOf = (claims: { readonly exp: number; readonly sub?: string }) =>
  Arr.join(
    [
      Base64Url.encode(encodeJson({ alg: "ES256", typ: "JWT" })),
      Base64Url.encode(encodeJson(claims)),
      "signature",
    ],
    "."
  );

/** A token that is still fresh, and one that has expired. */
const FRESH = tokenOf({ exp: 4_102_444_800, sub: "session-1" });
const EXPIRED = tokenOf({ exp: 1, sub: "session-1" });

/** The deployment's answer to a function that returned `value`. */
const success = (value: unknown) =>
  Response.json({ logLines: [], status: "success", value });

/** The signed-in account, as `auth/queries:getCurrentUser` answers it. */
const ADA = { appUser: { _id: "user-1", name: "Ada" } };

/** A rotated session, as `auth/core:refreshSession` answers it. */
const ROTATED = {
  kind: "rotated",
  tokens: {
    accessToken: FRESH,
    refreshToken: "next-refresh",
    refreshTokenExpiresAt: 4_102_444_800_000,
    userId: "user-1",
  },
};

/** Answers each function the read calls by its kind: the refresh mutation, then the account query. */
function answerWith(answers: {
  readonly mutation?: () => Promise<Response>;
  readonly query?: () => Promise<Response>;
}) {
  fetcher.mockImplementation((input) => {
    const path = new URL(String(input)).pathname;
    const answer = path === "/api/mutation" ? answers.mutation : answers.query;
    return answer === undefined
      ? Promise.reject(new Error(`unexpected ${path}`))
      : answer();
  });
}

/** A page request that sends `cookie`. */
const visit = (cookie?: string) =>
  new Request(
    "https://nakafa.com/id/user/settings",
    cookie === undefined ? {} : { headers: { cookie } }
  );

/** The name and value of each Set-Cookie value. */
const pairsOf = (setCookies: readonly string[]) =>
  Arr.map(setCookies, (value) => value.split(";")[0]);

beforeEach(() => {
  fetcher.mockReset();
  vi.stubEnv("VITE_CONVEX_URL", CONVEX_URL);
  vi.stubEnv("SITE_URL", "https://nakafa.com");
});

describe("readRequestSession", () => {
  it.effect(
    "makes no network call for a visitor without a session cookie",
    () =>
      Effect.gen(function* () {
        const session = yield* readRequestSession(visit("theme=dark"));

        expect(session.client._tag).toBe("SignedOut");
        expect(session.convexToken).toStrictEqual(Option.none());
        expect(fetcher).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "reads the account with a fresh access token and refreshes nothing",
    () =>
      Effect.gen(function* () {
        answerWith({ query: () => Promise.resolve(success(ADA)) });

        const session = yield* readRequestSession(
          visit(`${AUTH_REFRESH_COOKIE}=refresh; ${AUTH_JWT_COOKIE}=${FRESH}`)
        );

        expect(session.client).toMatchObject({
          _tag: "SignedIn",
          name: "Ada",
          sessionId: "session-1",
          userId: "user-1",
        });
        expect(session.convexToken).toStrictEqual(Option.some(FRESH));
        expect(session.setCookies).toEqual([]);
        expect(fetcher).toHaveBeenCalledTimes(1);
        const [, init] = fetcher.mock.calls[0] ?? [];
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Bearer ${FRESH}`
        );
      })
  );

  it.effect(
    "refreshes a session whose access token expired and sends its cookies back",
    () =>
      Effect.gen(function* () {
        answerWith({
          mutation: () => Promise.resolve(success(ROTATED)),
          query: () => Promise.resolve(success(ADA)),
        });

        const session = yield* readRequestSession(
          visit(`${AUTH_REFRESH_COOKIE}=refresh; ${AUTH_JWT_COOKIE}=${EXPIRED}`)
        );

        expect(session.client._tag).toBe("SignedIn");
        expect(pairsOf(session.setCookies)).toEqual([
          `${AUTH_JWT_COOKIE}=${FRESH}`,
          `${AUTH_REFRESH_COOKIE}=next-refresh`,
        ]);
      })
  );

  it.effect(
    "reads staging's own cookies and writes them back under its names",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("SITE_URL", "https://staging.nakafa.com");
        answerWith({
          mutation: () => Promise.resolve(success(ROTATED)),
          query: () => Promise.resolve(success(ADA)),
        });

        const session = yield* readRequestSession(
          visit(
            `${AUTH_JWT_COOKIE}=${FRESH}; ${PREFIX}${AUTH_REFRESH_COOKIE}=staging`
          )
        );

        expect(pairsOf(session.setCookies)).toEqual([
          `${PREFIX}${AUTH_JWT_COOKIE}=${FRESH}`,
          `${PREFIX}${AUTH_REFRESH_COOKIE}=next-refresh`,
        ]);
      })
  );

  it.effect(
    "reads a session that ended as a visitor and clears its cookies",
    () =>
      Effect.gen(function* () {
        answerWith({
          mutation: () => Promise.resolve(success({ kind: "noSession" })),
        });

        const session = yield* readRequestSession(
          visit(`${AUTH_REFRESH_COOKIE}=refresh`)
        );

        expect(session.client._tag).toBe("SignedOut");
        expect(pairsOf(session.setCookies)).toEqual([
          `${AUTH_JWT_COOKIE}=`,
          `${AUTH_REFRESH_COOKIE}=`,
        ]);
      })
  );

  it.effect("reads a session whose account is gone as a visitor", () =>
    Effect.gen(function* () {
      answerWith({ query: () => Promise.resolve(success(null)) });

      const session = yield* readRequestSession(
        visit(`${AUTH_REFRESH_COOKIE}=refresh; ${AUTH_JWT_COOKIE}=${FRESH}`)
      );

      expect(session.client._tag).toBe("SignedOut");
      expect(session.convexToken).toStrictEqual(Option.none());
    })
  );

  it.effect(
    "fails with a fetch reason when the refresh cannot reach the deployment",
    () =>
      Effect.gen(function* () {
        answerWith({ mutation: () => Promise.reject(new Error("offline")) });

        const error = yield* Effect.flip(
          readRequestSession(visit(`${AUTH_REFRESH_COOKIE}=refresh`))
        );

        expect(error).toStrictEqual(
          new SessionUnavailable({ reason: "fetch" })
        );
      })
  );

  it.effect(
    "fails with a fetch reason when the account read cannot reach the deployment",
    () =>
      Effect.gen(function* () {
        answerWith({ query: () => Promise.reject(new Error("offline")) });

        const error = yield* Effect.flip(
          readRequestSession(
            visit(`${AUTH_REFRESH_COOKIE}=refresh; ${AUTH_JWT_COOKIE}=${FRESH}`)
          )
        );

        expect(error).toStrictEqual(
          new SessionUnavailable({ reason: "fetch" })
        );
      })
  );

  it.effect(
    "fails with a body reason when the account answer is not an account",
    () =>
      Effect.gen(function* () {
        answerWith({ query: () => Promise.resolve(success({ other: true })) });

        const error = yield* Effect.flip(
          readRequestSession(
            visit(`${AUTH_REFRESH_COOKIE}=refresh; ${AUTH_JWT_COOKIE}=${FRESH}`)
          )
        );

        expect(error).toStrictEqual(new SessionUnavailable({ reason: "body" }));
      })
  );

  it.effect(
    "fails with a body reason when the access token names no session",
    () =>
      Effect.gen(function* () {
        const anonymous = tokenOf({ exp: 4_102_444_800 });

        const error = yield* Effect.flip(
          readRequestSession(
            visit(
              `${AUTH_REFRESH_COOKIE}=refresh; ${AUTH_JWT_COOKIE}=${anonymous}`
            )
          )
        );

        expect(error).toStrictEqual(new SessionUnavailable({ reason: "body" }));
        expect(fetcher).not.toHaveBeenCalled();
      })
  );
});
