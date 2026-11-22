// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { readAnswer } from "@/scripts/urls/answer";

const ORIGIN = "https://nakafa.com";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** One answer of the site: a status, and the location a redirect names. */
function reply(status: number, location?: string) {
  return new Response(null, {
    headers: location === undefined ? {} : { location },
    status,
  });
}

/** Answers each requested path with the reply the table gives it. */
function serve(table: Record<string, () => Response>) {
  fetcher.mockImplementation((input) => {
    const { pathname } = new URL(input instanceof Request ? input.url : input);
    const answer = table[pathname];
    return answer === undefined
      ? Promise.resolve(reply(404))
      : Promise.resolve(answer());
  });
}

/** Follows one path with the stubbed fetch. */
function answer(path: string) {
  return readAnswer(ORIGIN, path).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("readAnswer", () => {
  it.effect(
    "keeps a page that answers 200, asking without following redirects",
    () =>
      Effect.gen(function* () {
        serve({ "/en/about": () => reply(200) });

        const result = yield* answer("/en/about");

        expect(result).toStrictEqual({
          hops: [{ path: "/en/about", status: 200 }],
          path: "/en/about",
          verdict: "kept",
        });
        const [, init] = fetcher.mock.calls[0] ?? [];
        expect(init?.redirect).toBe("manual");
      })
  );

  it.effect("follows each redirect on the site to the page it ends in", () =>
    Effect.gen(function* () {
      serve({
        "/about": () => reply(308, "/en/about"),
        "/en/about": () => reply(200),
      });

      const result = yield* answer("/about");

      expect(result.verdict).toBe("kept");
      expect(result.hops).toStrictEqual([
        { path: "/about", status: 308 },
        { path: "/en/about", status: 200 },
      ]);
    })
  );

  it.effect("accepts an address that answers 410 Gone", () =>
    Effect.gen(function* () {
      serve({ "/id/events": () => reply(410) });

      expect((yield* answer("/id/events")).verdict).toBe("gone");
    })
  );

  it.effect(
    "breaks on a 404, a bare redirect, or a redirect off the site",
    () =>
      Effect.gen(function* () {
        serve({
          "/discord": () => reply(307, "https://discord.gg/nakafa"),
          "/empty": () => reply(308),
        });

        expect((yield* answer("/id/about")).verdict).toBe("broken");
        expect((yield* answer("/empty")).verdict).toBe("broken");
        expect((yield* answer("/discord")).verdict).toBe("broken");
      })
  );

  it.effect("breaks on a chain longer than three redirects", () =>
    Effect.gen(function* () {
      serve({
        "/a": () => reply(308, "/b"),
        "/b": () => reply(308, "/c"),
        "/c": () => reply(308, "/d"),
        "/d": () => reply(308, "/e"),
      });

      const result = yield* answer("/a");

      expect(result.verdict).toBe("broken");
      expect(result.hops).toHaveLength(4);
    })
  );

  it.effect(
    "asks again after a 5xx, and keeps the page that answers then",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(reply(503))
          .mockResolvedValueOnce(reply(200));

        const fiber = yield* Effect.forkChild(answer("/en"));
        yield* TestClock.adjust("1 second");
        const result = yield* Fiber.join(fiber);

        expect(result.verdict).toBe("kept");
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect("records the 5xx of an address that keeps failing", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(() => Promise.resolve(reply(502)));

      const fiber = yield* Effect.forkChild(answer("/en"));
      yield* TestClock.adjust("1 minute");
      const result = yield* Fiber.join(fiber);

      expect(result).toStrictEqual({
        hops: [{ path: "/en", status: 502 }],
        path: "/en",
        verdict: "broken",
      });
      expect(fetcher).toHaveBeenCalledTimes(3);
    })
  );

  it.effect(
    "records no answer when the site never replies or the request fails",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockImplementationOnce(() => new Promise<Response>(() => undefined))
          .mockRejectedValueOnce(new TypeError("network"))
          .mockRejectedValueOnce(new TypeError("network"));

        const fiber = yield* Effect.forkChild(answer("/en"));
        yield* TestClock.adjust("1 minute");
        const result = yield* Fiber.join(fiber);

        expect(result.hops).toStrictEqual([{ path: "/en", status: 0 }]);
        expect(result.verdict).toBe("broken");
      })
  );
});
