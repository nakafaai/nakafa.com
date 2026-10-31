// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { answerUnmatchedRequest } from "@/lib/routing/unmatched.server";

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which answers the static not-found page. */
  env: { ASSETS: assets },
}));

describe("unmatched request answer", () => {
  it.effect(
    "answers the asset not-found page with its own status and body",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(
          new Response("<h1>Page not found</h1>", {
            headers: { "content-type": "text/html; charset=utf-8" },
            status: 404,
          })
        );
        const request = new Request("https://nakafa.com/.env");

        const response = yield* answerUnmatchedRequest(request);

        expect(assets.fetch.mock.lastCall?.[0].url).toBe(request.url);
        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toBe(
          "text/html; charset=utf-8"
        );
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<h1>Page not found</h1>"
        );
      })
  );

  it.effect(
    "reads the page with a GET of the same address, so a POST's body is never forwarded",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(
          new Response("<h1>Page not found</h1>", { status: 404 })
        );
        const request = new Request(
          "https://nakafa.com/vendor/phpunit/src/Util/PHP/eval-stdin.php",
          { body: "<?php echo 1;", method: "POST" }
        );

        const response = yield* answerUnmatchedRequest(request);
        const read = assets.fetch.mock.lastCall?.[0];

        expect(response.status).toBe(404);
        expect(read?.url).toBe(request.url);
        expect(read?.method).toBe("GET");
        expect(read?.body).toBeNull();
        expect(request.bodyUsed).toBe(false);
      })
  );
});
