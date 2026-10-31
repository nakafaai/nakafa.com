// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { readBrowserPage } from "@/lib/routing/browser.server";

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

const release = vi.hoisted(() => ({ bound: true }));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which holds the release's browser shell, and which a prerender does not bind. */
  env: {
    get ASSETS() {
      return release.bound ? assets : undefined;
    },
  },
}));

vi.mock("@/lib/routing/rendered", () => ({
  /** The stand-in names `/en/home` as the one page that renders only in the browser. */
  isBrowserRoutePath: (url: URL) => url.pathname === "/en/home",
}));

beforeEach(() => {
  release.bound = true;
  assets.fetch
    .mockReset()
    .mockImplementation(() =>
      Promise.resolve(
        new Response("<html>shell</html>", { headers: { etag: '"shell"' } })
      )
    );
});

describe("readBrowserPage", () => {
  it.effect(
    "answers a browser-only page with the release's shell at the visitor's address",
    () =>
      Effect.gen(function* () {
        const page = yield* readBrowserPage(
          new Request("https://nakafa.com/en/home")
        );

        const [shell] = assets.fetch.mock.calls[0] ?? [];
        expect(shell?.url).toBe("https://nakafa.com/_shell");
        const response = Option.getOrThrow(page);
        expect(response.status).toBe(200);
        expect(response.headers.get("etag")).toBe('"shell"');
        expect(response.headers.get("content-type")).toBe(
          "text/html; charset=utf-8"
        );
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<html>shell</html>"
        );
      })
  );

  it.effect("answers a HEAD request for a browser-only page with no body", () =>
    Effect.gen(function* () {
      const page = yield* readBrowserPage(
        new Request("https://nakafa.com/en/home", { method: "HEAD" })
      );

      expect(Option.getOrThrow(page).body).toBeNull();
    })
  );

  it.effect(
    "leaves a write, another page and a build without a release to their own answer",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readBrowserPage(
            new Request("https://nakafa.com/en/home", { method: "POST" })
          )
        ).toStrictEqual(Option.none());
        expect(
          yield* readBrowserPage(new Request("https://nakafa.com/en/search"))
        ).toStrictEqual(Option.none());
        release.bound = false;
        expect(
          yield* readBrowserPage(new Request("https://nakafa.com/en/home"))
        ).toStrictEqual(Option.none());
        expect(assets.fetch).not.toHaveBeenCalled();
      })
  );
});
