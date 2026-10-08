import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import {
  AuthRequestDeadline,
  AuthRequestFailed,
  authFetch,
  requestWithDeadline,
} from "@/lib/auth/request";

const AUTH_URL = "https://nakafa.com/api/auth/get-session";

/** One fetch double for the whole file, stubbed globally for the Promise seam. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * A request that waits until its signal aborts, then rejects as fetch does. A
 * signal that is already aborted rejects at once, because its abort event has
 * already fired.
 */
function waitsForAbort() {
  return (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const abort = () =>
        reject(new DOMException("The operation was aborted.", "AbortError"));
      if (init?.signal?.aborted) {
        abort();
        return;
      }
      init?.signal?.addEventListener("abort", abort);
    });
}

describe("requestWithDeadline", () => {
  it.effect("returns the response of a request answered in time", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response("session"));

      const response = yield* requestWithDeadline(fetcher, AUTH_URL);

      expect(response.status).toBe(200);
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "aborts a request that never answers exactly at the 10 second deadline",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(waitsForAbort());
        const fiber = yield* Effect.forkChild(
          requestWithDeadline(fetcher, AUTH_URL).pipe(Effect.flip)
        );

        yield* TestClock.adjust("9999 millis");
        const signal = fetcher.mock.calls[0]?.[1]?.signal;
        expect(signal?.aborted).toBe(false);
        yield* TestClock.adjust("1 millis");

        expect(yield* Fiber.join(fiber)).toStrictEqual(
          new AuthRequestDeadline()
        );
        expect(signal?.aborted).toBe(true);
      })
  );

  it.effect("aborts at once when the caller aborts", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(waitsForAbort());
      const caller = new AbortController();
      const fiber = yield* Effect.forkChild(
        requestWithDeadline(fetcher, AUTH_URL, {
          signal: caller.signal,
        }).pipe(Effect.flip)
      );
      yield* TestClock.adjust("1 millis");
      const signal = fetcher.mock.calls[0]?.[1]?.signal;

      caller.abort();

      expect(yield* Fiber.join(fiber)).toBeInstanceOf(AuthRequestFailed);
      expect(signal?.aborted).toBe(true);
    })
  );

  it.effect("fails at once when the caller had already aborted", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(waitsForAbort());
      const caller = new AbortController();
      caller.abort();

      const error = yield* requestWithDeadline(fetcher, AUTH_URL, {
        signal: caller.signal,
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(AuthRequestFailed);
      expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    })
  );

  it.effect(
    "fails with the transport failure when the request is refused",
    () =>
      Effect.gen(function* () {
        fetcher.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        const error = yield* requestWithDeadline(fetcher, AUTH_URL).pipe(
          Effect.flip
        );

        expect(error).toBeInstanceOf(AuthRequestFailed);
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );
});

describe("authFetch", () => {
  it("answers the browser client's request with the global fetch", async () => {
    fetcher.mockResolvedValueOnce(new Response("session"));

    const response = await authFetch(AUTH_URL, { method: "GET" });

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith(
      AUTH_URL,
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      })
    );
  });
});
