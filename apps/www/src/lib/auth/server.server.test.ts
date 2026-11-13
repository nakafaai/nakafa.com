// @vitest-environment node
import { AUTH_JWT_COOKIE, AUTH_REFRESH_COOKIE } from "@convex-dev/auth/ssr";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Schema, String as Str } from "effect";
import {
  expiredHintCookie,
  hintScopeFor,
  signedInHintCookie,
} from "@/lib/auth/hint";
import { readAuthRoutes } from "@/lib/auth/server.server";

const CONVEX_URL = "https://example.convex.cloud";
const STAGING = "https://staging.nakafa.com";
const PRODUCTION = "https://nakafa.com";
const PREFIX = "nakafa-dev.";

/** The deployment's answers, one double for the file (AGENTS.md). */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

/** The body of a call that the routes sent to the deployment. */
const MutationCall = Schema.fromJsonString(
  Schema.Struct({
    args: Schema.Tuple([Schema.Struct({ refreshToken: Schema.String })]),
    path: Schema.String,
  })
);

/** The deployment's answer to a mutation that returned `value`. */
const answer = (value: unknown) =>
  Response.json({ logLines: [], status: "success", value });

/** A refresh that rotated the session. */
const rotated = {
  kind: "rotated",
  tokens: {
    accessToken: "access",
    refreshToken: "next-refresh",
    refreshTokenExpiresAt: 4_102_444_800_000,
    userId: "user-1",
  },
};

/** A browser's post to one of the site's auth routes, with the cookies it sends, if any. */
const post = (site: string, route: string, cookie?: string) =>
  new Request(`${site}/api/auth/${route}`, {
    headers: {
      host: new URL(site).host,
      origin: site,
      ...(cookie === undefined ? {} : { cookie }),
    },
    method: "POST",
  });

/** The name and value of each Set-Cookie header of an answer. */
const pairsOf = (response: Response) =>
  Arr.map(response.headers.getSetCookie(), (value) =>
    Arr.headNonEmpty(Str.split(value, ";"))
  );

/** What the deployment was asked, as the decoded body of each call. */
const calls = () =>
  Arr.map(fetcher.mock.calls, ([, init]) =>
    Schema.decodeUnknownSync(MutationCall)(init?.body)
  );

beforeEach(() => {
  fetcher.mockReset();
  vi.stubEnv("VITE_CONVEX_URL", CONVEX_URL);
  vi.stubEnv("SITE_URL", STAGING);
});

describe("readAuthRoutes", () => {
  it.effect(
    "refreshes staging's own session and writes it back under staging's names",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(answer(rotated));
        const routes = yield* readAuthRoutes();

        const response = yield* Effect.promise(() =>
          routes.refreshHandler(
            post(
              STAGING,
              "refresh",
              `${AUTH_REFRESH_COOKIE}=production; ${PREFIX}${AUTH_REFRESH_COOKIE}=staging`
            )
          )
        );

        expect(calls()).toEqual([
          {
            args: [{ refreshToken: "staging" }],
            path: "auth/core:refreshSession",
          },
        ]);
        expect(pairsOf(response)).toEqual([
          `${PREFIX}${AUTH_JWT_COOKIE}=access`,
          `${PREFIX}${AUTH_REFRESH_COOKIE}=next-refresh`,
          signedInHintCookie(hintScopeFor(new URL(STAGING))).split(";")[0],
        ]);
        expect(yield* Effect.promise(() => response.json())).toEqual({
          tokens: { accessToken: "access", userId: "user-1" },
        });
      })
  );

  it.effect("signs staging out and expires the hint", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(answer(null));
      const routes = yield* readAuthRoutes();

      const response = yield* Effect.promise(() =>
        routes.signOutHandler(
          post(STAGING, "signout", `${PREFIX}${AUTH_REFRESH_COOKIE}=staging`)
        )
      );

      expect(calls()).toEqual([
        { args: [{ refreshToken: "staging" }], path: "auth/core:signOut" },
      ]);
      expect(pairsOf(response)).toEqual([
        `${PREFIX}${AUTH_JWT_COOKIE}=`,
        `${PREFIX}${AUTH_REFRESH_COOKIE}=`,
        expiredHintCookie(hintScopeFor(new URL(STAGING))).split(";")[0],
      ]);
    })
  );

  it.effect(
    "keeps production's cookies under Convex Auth's names for the whole domain",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("SITE_URL", PRODUCTION);
        fetcher.mockResolvedValueOnce(answer(rotated));
        const routes = yield* readAuthRoutes();

        const response = yield* Effect.promise(() =>
          routes.refreshHandler(
            post(PRODUCTION, "refresh", `${AUTH_REFRESH_COOKIE}=production`)
          )
        );

        expect(calls()[0]?.args).toEqual([{ refreshToken: "production" }]);
        expect(Arr.take(response.headers.getSetCookie(), 2)).toEqual([
          expect.stringMatching(
            new RegExp(`^${AUTH_JWT_COOKIE}=access;.*Domain=nakafa\\.com`, "u")
          ),
          expect.stringMatching(
            new RegExp(
              `^${AUTH_REFRESH_COOKIE}=next-refresh;.*Domain=nakafa\\.com`,
              "u"
            )
          ),
        ]);
      })
  );

  it.effect(
    "answers a browser without a session cookie with no session and no cookie",
    () =>
      Effect.gen(function* () {
        const routes = yield* readAuthRoutes();

        const response = yield* Effect.promise(() =>
          routes.refreshHandler(post(STAGING, "refresh"))
        );

        expect(fetcher).not.toHaveBeenCalled();
        expect(response.status).toBe(401);
        expect(response.headers.getSetCookie()).toEqual([]);
      })
  );
});
