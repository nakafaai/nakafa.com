// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  answerSchoolPage,
  readSchoolFile,
} from "@/lib/routing/school/shell.server";

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

describe("readSchoolFile", () => {
  it.effect(
    "answers a file that a school host's address names with the static not-found page",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(
          new Response("<h1>Not found</h1>", { status: 404 })
        );

        const answer = yield* readSchoolFile(
          request("https://n8n.nakafa.com/.env")
        );

        const response = Option.getOrThrow(answer);
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("no-store");
        const [file] = assets.fetch.mock.calls[0] ?? [];
        expect(file?.url).toBe("https://n8n.nakafa.com/.env");
      })
  );

  it.effect(
    "answers nothing for a page, a shared route, a write, another host or a prerender",
    () =>
      Effect.gen(function* () {
        for (const other of [
          request("https://harapan.nakafa.com/exams"),
          request("https://harapan.nakafa.com/api/weather.json"),
          request("https://harapan.nakafa.com/.env", "POST"),
          request("https://nakafa.com/.env"),
        ]) {
          expect(Option.isNone(yield* readSchoolFile(other))).toBe(true);
        }
        release.bound = false;
        expect(
          Option.isNone(
            yield* readSchoolFile(request("https://harapan.nakafa.com/.env"))
          )
        ).toBe(true);
        expect(assets.fetch).not.toHaveBeenCalled();
      })
  );
});
