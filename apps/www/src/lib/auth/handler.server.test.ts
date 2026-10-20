// @vitest-environment node

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { Effect } from "effect";

const CONVEX_SITE_URL = "https://test.convex.site";
/**
 * One fetch for the whole file: the adapter ends in a Promise, so the double is
 * global, and Effect's client keeps the first global fetch it reads.
 */
const fetcher = vi.fn<typeof fetch>();

const loadAuthServer = Effect.fn("auth.server.test.load")(() =>
  Effect.tryPromise(() => import("@/lib/auth/handler.server"))
);

beforeAll(() => {
  vi.stubEnv("AKSARA_PUBLICATION_TOKEN", "test-publication-token");
  vi.stubEnv("VITE_CONVEX_URL", "https://test.convex.cloud");
  vi.stubEnv("VITE_CONVEX_SITE_URL", CONVEX_SITE_URL);
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

      const response = yield* Effect.tryPromise(() => handler(request));
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
});
