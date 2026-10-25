import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { requestLocalizedHref } from "@/lib/routing/locale/request";

const CURRENT_HREF = "/en/quran/2?verse=3";
/** 43 URL-safe characters, the shape of a share token. */
const SHARE_TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE";

/** Resolves one href through the module's own client with a controlled fetch. */
function request(fetcher: typeof fetch, href = CURRENT_HREF) {
  return requestLocalizedHref({ href, locale: "id" }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/** A rejected fetch with an Undici network code, as the library's fetch raises it. */
function networkFailure(code: string) {
  return new TypeError("fetch failed", {
    cause: Object.assign(new Error("private socket detail"), { code }),
  });
}

function neverAnswers() {
  return new Promise<Response>(() => undefined);
}

describe("requestLocalizedHref", () => {
  it.effect("asks the route-owned endpoint for the chosen locale", () =>
    Effect.gen(function* () {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ href: "/id/quran/2" }));
      const endpoint = new URL(
        "/api/internal/routing/locale",
        window.location.href
      );
      endpoint.searchParams.set("href", CURRENT_HREF);
      endpoint.searchParams.set("locale", "id");

      expect(yield* request(fetcher)).toEqual({ href: "/id/quran/2" });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          headers: expect.objectContaining({ accept: "application/json" }),
          method: "GET",
        })
      );
    })
  );
  it.effect.each([
    ["a plain path", "/en/quran/2", "/en/quran/2", ""],
    [
      "a query and an anchor",
      "/en/quran/2?verse=3#top",
      "/en/quran/2?verse=3",
      "#top",
    ],
    [
      "a share token",
      `/en/chat/chat-1#share=${SHARE_TOKEN}`,
      "/en/chat/chat-1",
      `#share=${SHARE_TOKEN}`,
    ],
    ["a second hash sign", "/en/search?q=a#b#c", "/en/search?q=a", "#b#c"],
  ] as const)(
    "keeps the fragment of %s in the browser and puts it back on the answer",
    ([, href, path, fragment]) =>
      Effect.gen(function* () {
        const fetcher = vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json({ href: "/id/page" }));

        expect(yield* request(fetcher, href)).toEqual({
          href: `/id/page${fragment}`,
        });
        const sent = new URL(String(fetcher.mock.calls[0]?.[0]));
        expect(sent.searchParams.get("href")).toBe(path);
        expect(sent.href).not.toContain("#");
        expect(sent.href).not.toContain(SHARE_TOKEN);
      })
  );
  it.effect.each([
    ["a refused request", () => Response.json({}, { status: 404 })],
    ["a response outside the contract", () => Response.json({ path: "/id" })],
    ["a response that is not JSON", () => new Response("<html>")],
  ] as const)("fails with a typed error on %s", ([, respond]) =>
    Effect.gen(function* () {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respond());
      const error = yield* request(fetcher).pipe(Effect.flip);
      expect(error._tag).toBe("LocalizedHrefRequestError");
    })
  );
  it.effect("fails with a typed error when the request cannot be sent", () =>
    Effect.gen(function* () {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError("offline"));
      const error = yield* request(fetcher).pipe(Effect.flip);
      expect(error._tag).toBe("LocalizedHrefRequestError");
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );
  it.effect(
    "repeats a retryable network failure once, after 500 milliseconds",
    () =>
      Effect.gen(function* () {
        const fetcher = vi
          .fn<typeof fetch>()
          .mockRejectedValueOnce(networkFailure("ECONNRESET"))
          .mockResolvedValueOnce(Response.json({ href: "/id/quran/2" }));
        const fiber = yield* Effect.forkChild(request(fetcher));

        yield* TestClock.adjust("499 millis");
        expect(fetcher).toHaveBeenCalledOnce();
        yield* TestClock.adjust("1 millis");

        expect(yield* Fiber.join(fiber)).toEqual({ href: "/id/quran/2" });
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );
  it.effect("repeats an attempt that misses its 10 second deadline", () =>
    Effect.gen(function* () {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementationOnce(neverAnswers)
        .mockResolvedValueOnce(Response.json({ href: "/id/quran/2" }));
      const fiber = yield* Effect.forkChild(request(fetcher));

      // The first attempt ends at its deadline, then waits 500 milliseconds.
      yield* TestClock.adjust("10500 millis");

      expect(yield* Fiber.join(fiber)).toEqual({ href: "/id/quran/2" });
      expect(fetcher).toHaveBeenCalledTimes(2);
    })
  );
  it.effect("fails with a typed error after three missed deadlines", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(neverAnswers);
      const fiber = yield* Effect.forkChild(request(fetcher).pipe(Effect.flip));

      // Three attempts of ten seconds, with the 500 millisecond and 1 second waits.
      yield* TestClock.adjust("31500 millis");

      expect((yield* Fiber.join(fiber))._tag).toBe("LocalizedHrefRequestError");
      expect(fetcher).toHaveBeenCalledTimes(3);
    })
  );
  it.effect("does not repeat a refused request", () =>
    Effect.gen(function* () {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({}, { status: 404 }));

      expect((yield* request(fetcher).pipe(Effect.flip))._tag).toBe(
        "LocalizedHrefRequestError"
      );
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );
});
