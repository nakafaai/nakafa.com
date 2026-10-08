// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { type Duration, Effect, Fiber, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { readSessionToken, SessionTokenUnavailable } from "@/lib/auth/token";

const SITE_URL = "https://example.convex.site";
const TOKEN_URL = "https://example.convex.site/api/auth/convex/token";
const SESSION_COOKIE = "better-auth.session_token=session-value";
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/**
 * Reads the token for one request through the module's own client and this
 * file's fetch double.
 */
function readToken(
  headers = new Headers({ accept: "text/html", cookie: SESSION_COOKIE })
) {
  return readSessionToken(SITE_URL, headers).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/**
 * Runs one read while the test clock passes the time its attempts and waits
 * take.
 */
function readTokenWithin(elapsed: Duration.Input) {
  return Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(readToken());
    yield* TestClock.adjust(elapsed);
    return yield* Fiber.join(fiber);
  });
}

describe("readSessionToken", () => {
  it.effect("sends no request without a session cookie", () =>
    Effect.gen(function* () {
      const headers = new Headers({
        accept: "text/html",
        cookie: "theme=dark",
      });

      expect(yield* readToken(headers)).toBeUndefined();
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("sends the helper's headers and returns the token", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(Response.json({ token: "token-value" }));
      const headers = new Headers({
        accept: "text/html",
        cookie: SESSION_COOKIE,
        "content-length": "2",
        "transfer-encoding": "chunked",
        "x-forwarded-host": "nakafa.com",
      });

      expect(yield* readToken(headers)).toBe("token-value");
      expect(fetcher).toHaveBeenCalledOnce();
      const [url, init] = fetcher.mock.calls[0] ?? [];
      const sent = new Headers(init?.headers);
      expect(String(url)).toBe(TOKEN_URL);
      expect(init?.method).toBe("GET");
      expect(sent.get("host")).toBe("example.convex.site");
      expect(sent.get("accept-encoding")).toBe("identity");
      expect(sent.get("x-forwarded-host")).toBe("nakafa.com");
      expect(sent.has("cookie")).toBe(true);
      expect(sent.has("content-length")).toBe(false);
      expect(sent.has("transfer-encoding")).toBe(false);
    })
  );

  it.effect("returns no token for a 401 answer, after one request", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

      expect(yield* readToken()).toBeUndefined();
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect("fails at once with the status of another refused answer", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));

      const error = yield* readToken().pipe(Effect.flip);

      expect(error).toStrictEqual(
        new SessionTokenUnavailable({ reason: "status", status: 403 })
      );
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect("retries a 5xx answer twice, then returns the token", () =>
    Effect.gen(function* () {
      fetcher
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
        .mockResolvedValueOnce(Response.json({ token: "token-value" }));

      // The retries wait 500 milliseconds and then 1 second.
      expect(yield* readTokenWithin("1500 millis")).toBe("token-value");
      expect(fetcher).toHaveBeenCalledTimes(3);
    })
  );

  it.effect("fails after three 5xx answers with the last status only", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(
        async () =>
          new Response("private-body-value", {
            headers: { "x-private": "private-header-value" },
            status: 503,
          })
      );

      const error = yield* readTokenWithin("1500 millis").pipe(Effect.flip);

      expect(error).toStrictEqual(
        new SessionTokenUnavailable({ reason: "status", status: 503 })
      );
      expect(encodeJson(error)).not.toContain("private-body-value");
      expect(encodeJson(error)).not.toContain("private-header-value");
      expect(encodeJson(error)).not.toContain("session-value");
      expect(fetcher).toHaveBeenCalledTimes(3);
    })
  );

  it.effect(
    "retries a network failure that Undici classifies as retryable",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockRejectedValueOnce(
            new TypeError("fetch failed", {
              cause: Object.assign(new Error("private socket detail"), {
                code: "ECONNRESET",
              }),
            })
          )
          .mockResolvedValueOnce(Response.json({ token: "token-value" }));

        expect(yield* readTokenWithin("500 millis")).toBe("token-value");
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect("fails at once with a network failure that is not retryable", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));

      const error = yield* readToken().pipe(Effect.flip);

      expect(error).toStrictEqual(
        new SessionTokenUnavailable({ reason: "fetch" })
      );
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect("retries an attempt that misses its deadline", () =>
    Effect.gen(function* () {
      fetcher
        .mockImplementationOnce(() => new Promise<Response>(() => undefined))
        .mockResolvedValueOnce(Response.json({ token: "token-value" }));

      // The first attempt ends at its ten second deadline, then waits 500 ms.
      expect(yield* readTokenWithin("10500 millis")).toBe("token-value");
      expect(fetcher).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("fails with the deadline reason after three missed deadlines", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(() => new Promise<Response>(() => undefined));

      // Three attempts of ten seconds, with the 500 ms and 1 s waits between.
      const error = yield* readTokenWithin("31500 millis").pipe(Effect.flip);

      expect(error).toStrictEqual(
        new SessionTokenUnavailable({ reason: "deadline" })
      );
      expect(fetcher).toHaveBeenCalledTimes(3);
    })
  );

  it.effect(
    "fails at once with a 200 body that is not the token contract",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(new Response("<html>", { status: 200 }));

        const error = yield* readToken().pipe(Effect.flip);

        expect(error).toStrictEqual(
          new SessionTokenUnavailable({ reason: "body" })
        );
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );
});
