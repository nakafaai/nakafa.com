import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import {
  AuthRequestDeadline,
  AuthRequestFailed,
  authFetch,
  readSession,
  requestWithDeadline,
} from "@/lib/auth/request";

const AUTH_URL = "https://nakafa.com/api/auth/get-session";
const TOKEN_URL = "https://nakafa.com/api/auth/convex/token";

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

/**
 * The caller's signal is a browser-owned controller rather than Effect-managed
 * cancellation, so the tests create it outside Effect code.
 */
function createCallerController() {
  return new AbortController();
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

  it.effect("stops watching the caller once the answer arrives", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response("session"));
      const caller = createCallerController();

      const response = yield* requestWithDeadline(fetcher, AUTH_URL, {
        signal: caller.signal,
      });
      caller.abort();

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

  it.effect(
    "aborts a response body that never ends at the 10 second deadline",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          new Response(new ReadableStream<Uint8Array>())
        );
        const fiber = yield* Effect.forkChild(
          requestWithDeadline(fetcher, AUTH_URL).pipe(Effect.flip)
        );

        yield* TestClock.adjust("9999 millis");
        const signal = fetcher.mock.calls[0]?.[1]?.signal;
        // pollUnsafe reads the exit without waiting: no exit means the body is pending.
        expect(fiber.pollUnsafe()).toBeUndefined();
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
      const caller = createCallerController();
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
      const caller = createCallerController();
      caller.abort();

      const error = yield* requestWithDeadline(fetcher, AUTH_URL, {
        signal: caller.signal,
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(AuthRequestFailed);
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

describe("readSession", () => {
  it.effect("returns the answer of a read that succeeds", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response("session"));

      const response = yield* readSession(fetcher, AUTH_URL);

      expect(response.status).toBe(200);
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect("reads again after the server answers with an error status", () =>
    Effect.gen(function* () {
      fetcher
        .mockResolvedValueOnce(new Response("refused", { status: 500 }))
        .mockResolvedValueOnce(new Response("session"));
      const fiber = yield* Effect.forkChild(readSession(fetcher, AUTH_URL));

      // The first wait of the shared schedule: 500 milliseconds.
      yield* TestClock.adjust("499 millis");
      expect(fetcher).toHaveBeenCalledOnce();
      yield* TestClock.adjust("1 millis");
      const response = yield* Fiber.join(fiber);

      expect(response.status).toBe(200);
      expect(fetcher).toHaveBeenCalledTimes(2);
    })
  );

  it.effect(
    "gives the caller the last refused answer once the shared schedule ends",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(new Response("first", { status: 500 }))
          .mockResolvedValueOnce(new Response("second", { status: 502 }))
          .mockResolvedValueOnce(new Response("third", { status: 503 }));
        const fiber = yield* Effect.forkChild(readSession(fetcher, AUTH_URL));

        // The waits of the shared schedule: 500 milliseconds, then 1 second.
        yield* TestClock.adjust("500 millis");
        yield* TestClock.adjust("1 second");
        const response = yield* Fiber.join(fiber);

        expect(response.status).toBe(503);
        expect(yield* Effect.promise(() => response.text())).toBe("third");
        expect(fetcher).toHaveBeenCalledTimes(3);
      })
  );

  it.effect("reads again when an attempt misses its deadline", () =>
    Effect.gen(function* () {
      fetcher
        .mockImplementationOnce(waitsForAbort())
        .mockResolvedValueOnce(new Response("session"));
      const fiber = yield* Effect.forkChild(readSession(fetcher, AUTH_URL));

      yield* TestClock.adjust("10 seconds");
      const firstSignal = fetcher.mock.calls[0]?.[1]?.signal;
      expect(firstSignal?.aborted).toBe(true);
      yield* TestClock.adjust("500 millis");
      const response = yield* Fiber.join(fiber);

      expect(response.status).toBe(200);
      expect(fetcher).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("keeps a client error as the answer without reading again", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(
        new Response("signed out", { status: 401 })
      );

      const response = yield* readSession(fetcher, AUTH_URL);

      expect(response.status).toBe(401);
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect("stops at once when the caller aborts while it waits", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response("refused", { status: 500 }));
      const caller = createCallerController();
      const fiber = yield* Effect.forkChild(
        readSession(fetcher, AUTH_URL, { signal: caller.signal }).pipe(
          Effect.flip
        )
      );
      yield* TestClock.adjust("1 millis");

      caller.abort();

      expect(yield* Fiber.join(fiber)).toBeInstanceOf(AuthRequestFailed);
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

  it("reads the session again after the server refuses it", async () => {
    fetcher
      .mockResolvedValueOnce(new Response("refused", { status: 500 }))
      .mockResolvedValueOnce(new Response("session"));

    const response = await authFetch(AUTH_URL, { method: "GET" });

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("reads the session again when its address has a query", async () => {
    fetcher
      .mockResolvedValueOnce(new Response("refused", { status: 500 }))
      .mockResolvedValueOnce(new Response("session"));

    const response = await authFetch(
      new URL(`${AUTH_URL}?disableCookieCache=true`),
      {
        method: "GET",
      }
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a write to the session route", AUTH_URL, { method: "POST" }],
    ["a read of another route", TOKEN_URL, { method: "GET" }],
    ["a request that names no method", AUTH_URL, undefined],
  ])("answers %s once, whatever its status", async (_name, input, init) => {
    fetcher.mockResolvedValueOnce(new Response("refused", { status: 500 }));

    const response = await authFetch(input, init);

    expect(response.status).toBe(500);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
