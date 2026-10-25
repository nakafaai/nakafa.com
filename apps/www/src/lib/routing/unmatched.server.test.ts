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

        expect(assets.fetch).toHaveBeenCalledWith(request);
        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toBe(
          "text/html; charset=utf-8"
        );
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<h1>Page not found</h1>"
        );
      })
  );
});
