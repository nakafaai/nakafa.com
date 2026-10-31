// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { answerSchoolRefusal } from "@/lib/routing/school/refused.server";

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

const release = vi.hoisted(() => ({ bound: true }));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which holds the release's not-found pages, and which a prerender does not bind. */
  env: {
    get ASSETS() {
      return release.bound ? assets : undefined;
    },
  },
}));

/** The answer of every request that the static page does not answer. */
const OTHERWISE = new Response("<html>page</html>");

/** A request to a school host, or to another host, as the platform passes it on. */
function request(address: string, method = "GET") {
  const url = new URL(address);
  return new Request(url, { headers: { host: url.host }, method });
}

beforeEach(() => {
  release.bound = true;
  assets.fetch.mockReset().mockImplementation(() =>
    Promise.resolve(
      new Response("<h1>We can't find this page</h1>", {
        headers: { "cache-control": "public, max-age=0", etag: '"page"' },
      })
    )
  );
});

describe("answerSchoolRefusal", () => {
  it.effect(
    "answers a refused school page with the static not-found page of its locale for a school host, never stored",
    () =>
      Effect.gen(function* () {
        const response = yield* answerSchoolRefusal(
          request("https://zz-unknown.nakafa.com/"),
          "id",
          Effect.succeed(OTHERWISE)
        );

        const [page] = assets.fetch.mock.calls[0] ?? [];
        expect(page?.url).toBe(
          "https://zz-unknown.nakafa.com/_notfound/school/id"
        );
        expect(page?.method).toBe("GET");
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("content-type")).toBe(
          "text/html; charset=utf-8"
        );
        expect(response.headers.get("content-language")).toBe("id");
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<h1>We can't find this page</h1>"
        );
      })
  );

  it.effect("answers a HEAD request with no body", () =>
    Effect.gen(function* () {
      const response = yield* answerSchoolRefusal(
        request("https://zz-unknown.nakafa.com/", "HEAD"),
        "en",
        Effect.succeed(OTHERWISE)
      );

      expect(response.status).toBe(404);
      expect(response.body).toBeNull();
    })
  );

  it.effect(
    "leaves another host, a file and a prerender without a release to their own answer",
    () =>
      Effect.gen(function* () {
        for (const other of [
          request("https://nakafa.com/en/exams"),
          request("https://harapan.nakafa.com/assets/old.js"),
        ]) {
          expect(
            yield* answerSchoolRefusal(other, "en", Effect.succeed(OTHERWISE))
          ).toBe(OTHERWISE);
        }
        release.bound = false;
        expect(
          yield* answerSchoolRefusal(
            request("https://harapan.nakafa.com/exams"),
            "en",
            Effect.succeed(OTHERWISE)
          )
        ).toBe(OTHERWISE);
        expect(assets.fetch).not.toHaveBeenCalled();
      })
  );
});
