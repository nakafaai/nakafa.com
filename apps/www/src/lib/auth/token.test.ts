// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { readBrowserSession } from "@/lib/auth/token";

const ORIGIN = "https://harapan.nakafa.com";

/** The refresh route's answer for a signed-in session. */
const SIGNED_IN = { tokens: { accessToken: "token-value", userId: "user-1" } };

/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** Reads the session in a browser on this file's origin, through this file's fetch double. */
function readToken() {
  return readBrowserSession(ORIGIN).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("readBrowserSession", () => {
  it.effect(
    "reads the session from the refresh route of the page's own host",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(Response.json(SIGNED_IN));

        expect(yield* readToken()).toEqual(SIGNED_IN.tokens);
        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(String(url)).toBe(`${ORIGIN}/api/auth/refresh`);
        expect(init?.method).toBe("POST");
      })
  );

  it.effect("answers no session for a visitor", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

      expect(yield* readToken()).toBeNull();
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "answers no session when the route answers no tokens, as it does for an ended session",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(Response.json({ tokens: null }));

        expect(yield* readToken()).toBeNull();
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "asks again when the browser drops the request with no network code",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockRejectedValueOnce(new TypeError("Failed to fetch"))
          .mockResolvedValueOnce(Response.json(SIGNED_IN));
        const fiber = yield* Effect.forkChild(readToken());

        yield* TestClock.adjust("500 millis");

        expect(yield* Fiber.join(fiber)).toEqual(SIGNED_IN.tokens);
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect("fails on a 200 that carries no tokens field", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(Response.json({}));

      const error = yield* Effect.flip(readToken());

      expect(error.reason).toBe("body");
    })
  );

  it.effect("asks again after a server failure, then answers", () =>
    Effect.gen(function* () {
      fetcher
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(Response.json(SIGNED_IN));
      const fiber = yield* Effect.forkChild(readToken());

      yield* TestClock.adjust("500 millis");

      expect(yield* Fiber.join(fiber)).toEqual(SIGNED_IN.tokens);
      expect(fetcher).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("fails at once with the status of any other refusal", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }));

      const error = yield* Effect.flip(readToken());

      expect(error).toMatchObject({ reason: "status", status: 403 });
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );
});
