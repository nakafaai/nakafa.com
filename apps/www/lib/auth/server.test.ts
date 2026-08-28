// @vitest-environment node

import "next/dist/server/node-environment-baseline";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { Effect } from "effect";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { createRequestStore } from "next/dist/server/async-storage/request-store";
import { createWorkStore } from "next/dist/server/async-storage/work-store";
import { vi } from "vitest";

const CONVEX_SITE_URL = "https://test.convex.site";

let handler: typeof import("./server")["handler"];
let getToken: typeof import("./server")["getToken"];

const runWithRequestHeaders = (headers: Headers) => {
  const requestStore = createRequestStore({
    fallbackParams: null,
    headers,
    hmrRefreshHash: undefined,
    implicitTags: { expirationsByCacheKind: new Map(), tags: [] },
    isHmrRefresh: false,
    onUpdateCookies: undefined,
    phase: "render",
    previewProps: undefined,
    resumeDataCache: null,
    rootParams: {},
    serverComponentsHmrCache: undefined,
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
        isRoutePPREnabled: false,
        useCacheTimeout: 50,
      },
      isBuildTimePrerendering: false,
      isDebugDynamicAccesses: false,
      isDraftMode: false,
      onAfterTaskError: undefined,
      onClose: () => undefined,
      staticPageGenerationTimeout: 60,
      supportsDynamicResponse: true,
      validationLevel: "warning",
      waitUntil: undefined,
    },
  });

  return Effect.tryPromise(() =>
    workAsyncStorage.run(workStore, () =>
      workUnitAsyncStorage.run(requestStore, getToken)
    )
  );
};

beforeAll(async () => {
  vi.stubEnv("INTERNAL_CONTENT_API_KEY", "test-content-key");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", CONVEX_SITE_URL);
  vi.stubEnv("NEXT_PUBLIC_MCP_URL", "https://test.example.com/mcp");
  vi.stubEnv("SITE_URL", "https://nakafa.com");

  ({ getToken, handler } = await import("./server"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("Better Auth server boundary", () => {
  it.effect("forwards auth routes through the installed adapter", () =>
    Effect.gen(function* () {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 200 }));
      const request = new Request(
        "https://nakafa.com/api/auth/sign-in/social",
        {
          body: "{}",
          headers: { "x-forwarded-host": "proxy.internal.example.com" },
          method: "POST",
        }
      );

      const response = yield* Effect.tryPromise(() => handler.POST(request));
      const [, init] = fetchSpy.mock.calls[0] ?? [];
      const headers = new Headers(init?.headers);

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(fetchSpy.mock.calls[0]?.[0]).toBe(
        `${CONVEX_SITE_URL}/api/auth/sign-in/social`
      );
      expect(headers.get("host")).toBe("test.convex.site");
      expect(headers.get("x-forwarded-proto")).toBe("https");
    })
  );

  it.effect("gets the SSR token through the installed adapter", () =>
    Effect.gen(function* () {
      const cookie = "better-auth.session_token=session-cookie";
      const requestHeaders = new Headers({
        cookie,
        host: "render.internal.example.com",
        "x-forwarded-host": "nakafa.com",
        "x-forwarded-proto": "https",
      });
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(Response.json({ token: "test-token" }));

      const token = yield* runWithRequestHeaders(requestHeaders);
      expect(token).toBe("test-token");
      const [, init] = fetchSpy.mock.calls[0] ?? [];
      const headers = new Headers(init?.headers);

      expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
        `${CONVEX_SITE_URL}/api/auth/convex/token`
      );
      expect(headers.get("host")).toBe("test.convex.site");
      expect(headers.get("cookie")).toBe(cookie);
    })
  );
});
