// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { answerStaticPath } from "@/lib/routing/assets.server";
import type { RouterHandler } from "@/lib/routing/routed.server";

vi.hoisted(() => {
  vi.stubEnv("SITE_URL", "https://nakafa.com");
});

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding: the sign-in page, or the not-found page. */
  env: { ASSETS: assets },
}));

vi.mock("@repo/analytics/server-reporting", () => ({
  reportUncaughtRequestError: () => Effect.void,
}));

vi.mock("@tanstack/react-start/server", () => ({
  handleStartError: () => new Response("Start error", { status: 500 }),
}));

/** A router that answers the gate's redirect, and records each request it receives. */
function router() {
  return vi.fn<RouterHandler>(() =>
    Promise.resolve(
      new Response(null, { headers: { location: "/en/home" }, status: 307 })
    )
  );
}

/** A request for one address with the given cookie header. */
function requestOf(address: string, cookie?: string) {
  return new Request(`https://nakafa.com${address}`, {
    headers: cookie === undefined ? {} : { cookie },
  });
}

beforeEach(() => {
  assets.fetch
    .mockReset()
    .mockImplementation((request) =>
      Promise.resolve(
        new URL(request.url).pathname === "/en/auth"
          ? new Response("<h1>Sign in to Nakafa</h1>")
          : new Response("<h1>Not found</h1>", { status: 404 })
      )
    );
});

describe("static path answer", () => {
  it.effect("answers a visitor's sign-in page with the prerendered page", () =>
    Effect.gen(function* () {
      const route = router();
      const request = requestOf("/en/auth?redirect=%2Fen", "theme=dark");

      const response = yield* answerStaticPath(request, route);

      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.text())).toBe(
        "<h1>Sign in to Nakafa</h1>"
      );
      expect(assets.fetch).toHaveBeenCalledWith(request);
      expect(route).not.toHaveBeenCalled();
    })
  );

  it.effect("sends a sign-in request that holds a session to the router", () =>
    Effect.gen(function* () {
      const route = router();

      const response = yield* answerStaticPath(
        requestOf(
          "/en/auth",
          "__Secure-better-auth.session_token=signed.value"
        ),
        route
      );

      expect(response.status).toBe(307);
      expect(route).toHaveBeenCalledTimes(1);
      expect(assets.fetch).not.toHaveBeenCalled();
    })
  );

  it.effect("answers every other path with the static not-found page", () =>
    Effect.gen(function* () {
      const route = router();

      const response = yield* answerStaticPath(
        requestOf("/en/wp-login.php"),
        route
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(route).not.toHaveBeenCalled();
    })
  );
});
