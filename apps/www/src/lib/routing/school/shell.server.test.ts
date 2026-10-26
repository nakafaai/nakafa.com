// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { answerSchoolPage } from "@/lib/routing/school/shell.server";

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

const release = vi.hoisted(() => ({ bound: true }));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which holds the release's school shell, and which a prerender does not bind. */
  env: {
    get ASSETS() {
      return release.bound ? assets : undefined;
    },
  },
}));

/** The answer of every request that the shell does not answer. */
const OTHERWISE = new Response("<html>page</html>");

/** A request to a school host, or to another host, as the platform passes it on. */
function request(address: string, method = "GET") {
  const url = new URL(address);
  return new Request(url, { headers: { host: url.host }, method });
}

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

describe("answerSchoolPage", () => {
  it.effect(
    "answers a school page with the release's shell at the visitor's address, its headers and the given status",
    () =>
      Effect.gen(function* () {
        const response = yield* answerSchoolPage(
          request("https://harapan.nakafa.com/exams"),
          404,
          Effect.succeed(OTHERWISE)
        );

        const [shell] = assets.fetch.mock.calls[0] ?? [];
        expect(shell?.url).toBe("https://harapan.nakafa.com/_school");
        expect(response.status).toBe(404);
        expect(response.headers.get("etag")).toBe('"shell"');
        expect(response.headers.get("content-type")).toBe(
          "text/html; charset=utf-8"
        );
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<html>shell</html>"
        );
      })
  );

  it.effect("answers a HEAD request for a school page with no body", () =>
    Effect.gen(function* () {
      const response = yield* answerSchoolPage(
        request("https://harapan.nakafa.com/", "HEAD"),
        200,
        Effect.succeed(OTHERWISE)
      );

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    })
  );

  it.effect(
    "leaves a write, a shared route, a file and another host to their own answer",
    () =>
      Effect.gen(function* () {
        for (const other of [
          request("https://harapan.nakafa.com/exams", "POST"),
          request("https://harapan.nakafa.com/api/auth/get-session"),
          request("https://harapan.nakafa.com/assets/old.js"),
          request("https://nakafa.com/en/exams"),
        ]) {
          expect(
            yield* answerSchoolPage(other, 200, Effect.succeed(OTHERWISE))
          ).toBe(OTHERWISE);
        }
        expect(assets.fetch).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "leaves a school page to the router when no release is bound, as in a prerender",
    () =>
      Effect.gen(function* () {
        release.bound = false;

        const response = yield* answerSchoolPage(
          request("https://harapan.nakafa.com/exams"),
          200,
          Effect.succeed(OTHERWISE)
        );

        expect(response).toBe(OTHERWISE);
        expect(assets.fetch).not.toHaveBeenCalled();
      })
  );
});
