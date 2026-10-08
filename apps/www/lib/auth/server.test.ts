// @vitest-environment node

import "next/dist/server/node-environment-baseline";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { Effect } from "effect";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { createRequestStore } from "next/dist/server/async-storage/request-store";
import { createWorkStore } from "next/dist/server/async-storage/work-store";
import { getImplicitTags } from "next/dist/server/lib/implicit-tags";
import type { getToken as getAuthToken } from "@/lib/auth/server";
import { SessionTokenUnavailable } from "@/lib/auth/token";

const CONVEX_SITE_URL = "https://test.convex.site";
/**
 * One fetch for the whole file: both readers end in a Promise, so the double is
 * global, and Effect's client keeps the first global fetch it reads.
 */
const fetcher = vi.fn<typeof fetch>();

const loadAuthServer = Effect.fn("auth.server.test.load")(() =>
  Effect.tryPromise(() => import("@/lib/auth/server"))
);

const runWithRequestHeaders = Effect.fn(
  "auth.server.test.runWithRequestHeaders"
)(function* (headers: Headers, getToken: typeof getAuthToken) {
  // Next.js builds the implicit tags itself, so the fixture holds its own types.
  const implicitTags = yield* Effect.promise(() =>
    getImplicitTags("/test/page", "/test", null)
  );
  const requestStore = createRequestStore({
    headers,
    hmrRefreshHash: undefined,
    implicitTags,
    isHmrRefresh: false,
    onUpdateCookies: undefined,
    phase: "render",
    previewProps: undefined,
    resumeDataCache: null,
    rootParams: {},
    serverComponentsHmrCache: undefined,
    stagedFallbackParams: null,
    url: { pathname: "/test" },
  });
  const workStore = createWorkStore({
    buildId: "test-build",
    deploymentId: "test-deployment",
    page: "/test/page",
    previouslyRevalidatedTags: [],
    renderOpts: {
      assetPrefix: "",
      cacheComponents: true,
      cacheLifeProfiles: {
        default: { expire: 31_536_000, revalidate: 900, stale: 300 },
      },
      experimental: {
        authInterrupts: false,
        durableUseCacheEntries: false,
        isRoutePPREnabled: false,
        useCacheTimeout: 50,
      },
      isBuildTimePrerendering: false,
      isDebugDynamicAccesses: false,
      isDraftMode: false,
      onAfterTaskError: undefined,
      onClose: () => undefined,
      staticPageGenerationTimeout: 60,
      validationLevel: "warning",
      waitUntil: undefined,
    },
  });

  return yield* Effect.tryPromise(() =>
    workAsyncStorage.run(workStore, () =>
      workUnitAsyncStorage.run(requestStore, getToken)
    )
  );
});

beforeAll(() => {
  vi.stubEnv("AKSARA_PUBLICATION_TOKEN", "test-publication-token");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", CONVEX_SITE_URL);
  vi.stubEnv("SITE_URL", "https://nakafa.com");
  vi.stubGlobal("fetch", fetcher);
});

beforeEach(() => {
  fetcher.mockReset();
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Better Auth server boundary", () => {
  it.effect("forwards auth routes through the installed adapter", () =>
    Effect.gen(function* () {
      const { handler } = yield* loadAuthServer();
      fetcher.mockResolvedValue(new Response(null, { status: 200 }));
      const request = new Request(
        "https://nakafa.com/api/auth/sign-in/social",
        {
          body: "{}",
          headers: { "x-forwarded-host": "proxy.internal.example.com" },
          method: "POST",
        }
      );

      const response = yield* Effect.tryPromise(() => handler.POST(request));
      const [, init] = fetcher.mock.calls[0] ?? [];
      const headers = new Headers(init?.headers);

      expect(response.status).toBe(200);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher.mock.calls[0]?.[0]).toBe(
        `${CONVEX_SITE_URL}/api/auth/sign-in/social`
      );
      expect(headers.get("host")).toBe("test.convex.site");
      expect(headers.get("x-forwarded-proto")).toBe("https");
    })
  );

  it.effect("gets the SSR token through the installed adapter", () =>
    Effect.gen(function* () {
      const { getToken } = yield* loadAuthServer();
      const cookie = "better-auth.session_token=session-cookie";
      const requestHeaders = new Headers({
        cookie,
        host: "render.internal.example.com",
        "x-forwarded-host": "nakafa.com",
        "x-forwarded-proto": "https",
      });
      fetcher.mockResolvedValue(Response.json({ token: "test-token" }));

      const token = yield* runWithRequestHeaders(requestHeaders, getToken);
      expect(token).toBe("test-token");
      const [, init] = fetcher.mock.calls[0] ?? [];
      const headers = new Headers(init?.headers);

      expect(String(fetcher.mock.calls[0]?.[0])).toBe(
        `${CONVEX_SITE_URL}/api/auth/convex/token`
      );
      expect(headers.get("host")).toBe("test.convex.site");
      expect(headers.get("cookie")).toBe(cookie);
    })
  );

  it.effect("rejects when the token route stays unavailable", () =>
    Effect.gen(function* () {
      const { getToken } = yield* loadAuthServer();
      fetcher.mockImplementation(
        async () => new Response(null, { status: 503 })
      );
      const requestHeaders = new Headers({
        cookie: "better-auth.session_token=session-cookie",
      });

      const error = yield* runWithRequestHeaders(requestHeaders, getToken).pipe(
        Effect.flip
      );
      expect(error.cause).toStrictEqual(
        new SessionTokenUnavailable({ reason: "status", status: 503 })
      );
      expect(fetcher).toHaveBeenCalledTimes(3);
    })
  );
});
