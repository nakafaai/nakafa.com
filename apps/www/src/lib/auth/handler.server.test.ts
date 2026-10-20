// @vitest-environment node

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import { SESSION_PATH } from "@/lib/auth/session";
import { SessionUnavailable } from "@/lib/auth/session.server";

const CONVEX_SITE_URL = "https://test.convex.site";
/** The Better Auth session that the session route answers for a signed-in learner. */
const SIGNED_IN_SESSION = {
  session: { id: "session-ada" },
  user: { id: "user-ada", name: "Ada" },
};
/**
 * One fetch for the whole file: both readers end in a Promise, so the double is
 * global, and Effect's client keeps the first global fetch it reads.
 */
const fetcher = vi.fn<typeof fetch>();

const request = vi.hoisted(() => ({
  current: new Request("https://nakafa.com/"),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => request.current,
}));

const loadAuthServer = Effect.fn("auth.server.test.load")(() =>
  Effect.tryPromise(() => import("@/lib/auth/handler.server"))
);

/** Runs one reader while the request that the server handles carries these headers. */
const runWithRequestHeaders = Effect.fn(
  "auth.server.test.runWithRequestHeaders"
)(function* (headers: Headers, getToken: () => Promise<string | undefined>) {
  request.current = new Request("https://nakafa.com/", { headers });
  return yield* Effect.tryPromise(() => getToken());
});

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

  it.effect("reads the SSR token of the request the server handles", () =>
    Effect.gen(function* () {
      const { getToken } = yield* loadAuthServer();
      const requestHeaders = new Headers({
        cookie: "better-auth.session_token=session-cookie",
        host: "render.internal.example.com",
        "x-forwarded-host": "nakafa.com",
        "x-forwarded-proto": "https",
      });
      fetcher.mockImplementation(async (url) =>
        String(url).endsWith(SESSION_PATH)
          ? Response.json(SIGNED_IN_SESSION)
          : Response.json({ token: "test-token" })
      );

      const token = yield* runWithRequestHeaders(requestHeaders, getToken);
      const tokenCall = Arr.findFirst(fetcher.mock.calls, ([url]) =>
        String(url).endsWith("/api/auth/convex/token")
      );
      const headers = new Headers(
        Option.getOrUndefined(tokenCall)?.[1]?.headers
      );

      expect(token).toBe("test-token");
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(headers.get("host")).toBe("test.convex.site");
      expect(headers.get("cookie")).toBe(
        "better-auth.session_token=session-cookie"
      );
    })
  );

  it.effect("answers no token for a visitor, and reads no session", () =>
    Effect.gen(function* () {
      const { getToken } = yield* loadAuthServer();

      const token = yield* runWithRequestHeaders(new Headers(), getToken);

      expect(token).toBeUndefined();
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects when the token route refuses the request", () =>
    Effect.gen(function* () {
      const { getToken } = yield* loadAuthServer();
      fetcher.mockImplementation(async (url) =>
        String(url).endsWith(SESSION_PATH)
          ? Response.json(SIGNED_IN_SESSION)
          : new Response(null, { status: 403 })
      );
      const requestHeaders = new Headers({
        cookie: "better-auth.session_token=session-cookie",
      });

      const error = yield* runWithRequestHeaders(requestHeaders, getToken).pipe(
        Effect.flip
      );
      expect(error.cause).toStrictEqual(
        new SessionUnavailable({ reason: "status", status: 403 })
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
    })
  );
});
