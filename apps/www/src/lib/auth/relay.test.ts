// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { NetworkRequestError } from "@repo/backend/client/network";
import { Array as Arr, Effect, Fiber, Schema } from "effect";
import { TestClock } from "effect/testing";
import {
  AuthProxyDeadline,
  answerAuthDeadline,
  createAuthProxy,
  readAuthResponse,
  writeAuthResponse,
} from "@/lib/auth/relay";

const GET_URL = "https://nakafa.com/api/auth/get-session";
const TOKEN_URL = "https://nakafa.com/api/auth/convex/token";
const POST_URL = "https://nakafa.com/api/auth/sign-in/email";
const SESSION_COOKIE = { cookie: "better-auth.session_token=signed-token" };
const SECURE_SESSION_COOKIE = {
  cookie: "__Secure-better-auth.session_token=signed-token",
};
const JsonTextSchema = Schema.fromJsonString(Schema.Unknown);

const handler = {
  GET: vi.fn<(request: Request) => Promise<Response>>(),
  POST: vi.fn<(request: Request) => Promise<Response>>(),
};

beforeEach(() => {
  handler.GET.mockReset();
  handler.POST.mockReset();
});

/** A rejected fetch with an Undici network code, as the library's fetch raises it. */
function networkFailure(code: string) {
  return new TypeError("fetch failed", {
    cause: Object.assign(new Error("private socket detail"), { code }),
  });
}

/**
 * A rejected fetch whose connection attempts failed with several codes, as Node
 * reports one failed attempt for each address.
 */
function networkFailures(codes: readonly string[]) {
  return new TypeError("fetch failed", {
    cause: new AggregateError(
      Arr.map(codes, (code) =>
        Object.assign(new Error("private socket detail"), { code })
      ),
      "several connection attempts failed"
    ),
  });
}

function neverAnswers() {
  return new Promise<Response>(() => undefined);
}

describe("readAuthResponse", () => {
  it.effect("answers a read with the handler's response", () =>
    Effect.gen(function* () {
      handler.GET.mockResolvedValueOnce(new Response("session"));

      const response = yield* readAuthResponse(handler, new Request(GET_URL));

      expect(response.status).toBe(200);
      expect(handler.GET).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "repeats a refused connection once, after the shared 500 millisecond wait",
    () =>
      Effect.gen(function* () {
        handler.GET.mockRejectedValueOnce(
          networkFailure("ECONNREFUSED")
        ).mockResolvedValueOnce(new Response("session"));
        const fiber = yield* Effect.forkChild(
          readAuthResponse(handler, new Request(GET_URL))
        );

        yield* TestClock.adjust("499 millis");
        expect(handler.GET).toHaveBeenCalledOnce();
        yield* TestClock.adjust("1 millis");

        expect((yield* Fiber.join(fiber)).status).toBe(200);
        expect(handler.GET).toHaveBeenCalledTimes(2);
      })
  );

  it.effect("fails with the network codes after its one repeat", () =>
    Effect.gen(function* () {
      handler.GET.mockRejectedValue(networkFailure("ECONNREFUSED"));
      const fiber = yield* Effect.forkChild(
        readAuthResponse(handler, new Request(GET_URL)).pipe(Effect.flip)
      );

      yield* TestClock.adjust("500 millis");

      expect(yield* Fiber.join(fiber)).toStrictEqual(
        new NetworkRequestError({ networkCodes: ["ECONNREFUSED"] })
      );
      expect(handler.GET).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("fails at once with a failure that is not a network error", () =>
    Effect.gen(function* () {
      handler.GET.mockRejectedValueOnce(new Error("private handler detail"));

      const error = yield* readAuthResponse(handler, new Request(GET_URL)).pipe(
        Effect.flip
      );

      expect(error).toStrictEqual(
        new NetworkRequestError({ networkCodes: [] })
      );
      expect(handler.GET).toHaveBeenCalledOnce();
    })
  );

  it.effect("fails at the 15 second deadline and never repeats the read", () =>
    Effect.gen(function* () {
      handler.GET.mockImplementation(neverAnswers);
      const fiber = yield* Effect.forkChild(
        readAuthResponse(handler, new Request(GET_URL)).pipe(Effect.flip)
      );

      yield* TestClock.adjust("14999 millis");
      expect(handler.GET).toHaveBeenCalledOnce();
      yield* TestClock.adjust("1 millis");

      expect(yield* Fiber.join(fiber)).toStrictEqual(new AuthProxyDeadline());
      expect(handler.GET).toHaveBeenCalledOnce();
    })
  );

  it.effect("counts a repeat inside the same 15 second deadline", () =>
    Effect.gen(function* () {
      handler.GET.mockRejectedValueOnce(
        networkFailure("ECONNREFUSED")
      ).mockImplementationOnce(neverAnswers);
      const fiber = yield* Effect.forkChild(
        readAuthResponse(handler, new Request(GET_URL)).pipe(Effect.flip)
      );

      yield* TestClock.adjust("14999 millis");
      expect(handler.GET).toHaveBeenCalledTimes(2);
      yield* TestClock.adjust("1 millis");

      expect(yield* Fiber.join(fiber)).toStrictEqual(new AuthProxyDeadline());
    })
  );

  it.effect(
    "does not repeat a reset connection, because the upstream may already have acted",
    () =>
      Effect.gen(function* () {
        handler.GET.mockRejectedValueOnce(
          networkFailure("ECONNRESET")
        ).mockResolvedValueOnce(new Response("session"));

        const error = yield* readAuthResponse(
          handler,
          new Request(GET_URL)
        ).pipe(Effect.flip);

        expect(error).toStrictEqual(
          new NetworkRequestError({ networkCodes: ["ECONNRESET"] })
        );
        expect(handler.GET).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "does not repeat a failure that carries a refused and a reset connection",
    () =>
      Effect.gen(function* () {
        handler.GET.mockRejectedValueOnce(
          networkFailures(["ECONNREFUSED", "ECONNRESET"])
        ).mockResolvedValueOnce(new Response("session"));

        const error = yield* readAuthResponse(
          handler,
          new Request(GET_URL)
        ).pipe(Effect.flip);

        expect(error).toStrictEqual(
          new NetworkRequestError({
            networkCodes: ["ECONNRESET", "ECONNREFUSED"],
          })
        );
        expect(handler.GET).toHaveBeenCalledOnce();
      })
  );
});

describe("writeAuthResponse", () => {
  it.effect("answers a write with the handler's response", () =>
    Effect.gen(function* () {
      handler.POST.mockResolvedValueOnce(new Response("signed in"));

      const response = yield* writeAuthResponse(
        handler,
        new Request(POST_URL, { method: "POST" })
      );

      expect(response.status).toBe(200);
      expect(handler.POST).toHaveBeenCalledOnce();
    })
  );

  it.effect("never repeats a write after a network failure", () =>
    Effect.gen(function* () {
      handler.POST.mockRejectedValueOnce(
        networkFailure("ECONNRESET")
      ).mockResolvedValueOnce(new Response("signed in"));

      const error = yield* writeAuthResponse(
        handler,
        new Request(POST_URL, { method: "POST" })
      ).pipe(Effect.flip);

      expect(error).toStrictEqual(
        new NetworkRequestError({ networkCodes: ["ECONNRESET"] })
      );
      expect(handler.POST).toHaveBeenCalledOnce();
    })
  );

  it.effect("fails at the 15 second deadline and never repeats the write", () =>
    Effect.gen(function* () {
      handler.POST.mockImplementation(neverAnswers);
      const fiber = yield* Effect.forkChild(
        writeAuthResponse(
          handler,
          new Request(POST_URL, { method: "POST" })
        ).pipe(Effect.flip)
      );

      yield* TestClock.adjust("15 seconds");

      expect(yield* Fiber.join(fiber)).toStrictEqual(new AuthProxyDeadline());
      expect(handler.POST).toHaveBeenCalledOnce();
    })
  );
});

describe("answerAuthDeadline", () => {
  it.effect("answers a missed deadline with 504 and a JSON error body", () =>
    Effect.gen(function* () {
      handler.GET.mockImplementation(neverAnswers);
      const fiber = yield* Effect.forkChild(
        readAuthResponse(handler, new Request(GET_URL)).pipe(answerAuthDeadline)
      );

      yield* TestClock.adjust("15 seconds");
      const response = yield* Fiber.join(fiber);

      expect(response.status).toBe(504);
      expect(response.headers.get("content-type")).toContain(
        "application/json"
      );
      expect(
        yield* Effect.promise(() => response.text()).pipe(
          Effect.map((text) => Schema.decodeSync(JsonTextSchema)(text))
        )
      ).toStrictEqual({
        code: "AUTH_PROXY_DEADLINE",
        message: "The authentication service did not answer in time.",
      });
    })
  );

  it.effect(
    "answers 504 when the upstream body never ends, at the 15 second deadline",
    () =>
      Effect.gen(function* () {
        handler.GET.mockResolvedValueOnce(
          new Response(new ReadableStream<Uint8Array>())
        );
        const fiber = yield* Effect.forkChild(
          readAuthResponse(handler, new Request(GET_URL)).pipe(
            answerAuthDeadline
          )
        );

        yield* TestClock.adjust("14999 millis");
        // pollUnsafe reads the exit without waiting: no exit means the body is pending.
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("1 millis");

        expect((yield* Fiber.join(fiber)).status).toBe(504);
      })
  );
});

describe("createAuthProxy", () => {
  it.effect("forwards reads and writes through the route methods", () =>
    Effect.gen(function* () {
      const proxy = createAuthProxy(handler);
      handler.GET.mockResolvedValueOnce(new Response("session"));
      handler.POST.mockResolvedValueOnce(new Response("signed in"));

      const read = yield* Effect.promise(() =>
        proxy.GET(new Request(GET_URL, { headers: SESSION_COOKIE }))
      );
      const write = yield* Effect.promise(() =>
        proxy.POST(new Request(POST_URL, { method: "POST" }))
      );

      expect(yield* Effect.promise(() => read.text())).toBe("session");
      expect(write.status).toBe(200);
      expect(handler.GET).toHaveBeenCalledOnce();
    })
  );

  it.effect.each([GET_URL, TOKEN_URL])(
    "answers the read %s of a visitor without a session cookie itself, and never reaches Convex",
    (url) =>
      Effect.gen(function* () {
        const proxy = createAuthProxy(handler);

        const read = yield* Effect.promise(() =>
          proxy.GET(
            new Request(url, { headers: { cookie: "NAKAFA_LOCALE=id" } })
          )
        );

        expect(read.status).toBe(200);
        expect(read.headers.get("cache-control")).toBe("no-store");
        expect(handler.GET).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "gives the token read of a session that has ended no token in place of Better Auth's 401",
    () =>
      Effect.gen(function* () {
        const proxy = createAuthProxy(handler);
        handler.GET.mockResolvedValueOnce(
          Response.json({ code: "UNAUTHORIZED" }, { status: 401 })
        );

        const read = yield* Effect.promise(() =>
          proxy.GET(new Request(TOKEN_URL, { headers: SESSION_COOKIE }))
        );

        expect(read.status).toBe(200);
        expect(
          yield* Effect.promise(() => read.text()).pipe(
            Effect.map((text) => Schema.decodeSync(JsonTextSchema)(text))
          )
        ).toStrictEqual({ token: null });
        expect(handler.GET).toHaveBeenCalledOnce();
      })
  );

  it.effect.each([
    { name: "session cookie", headers: SESSION_COOKIE },
    { name: "secure session cookie", headers: SECURE_SESSION_COOKIE },
    { name: "bearer token", headers: { authorization: "Bearer token" } },
  ])("forwards a session read that carries a $name", ({ headers }) =>
    Effect.gen(function* () {
      const proxy = createAuthProxy(handler);
      handler.GET.mockResolvedValueOnce(new Response("session"));

      const read = yield* Effect.promise(() =>
        proxy.GET(new Request(GET_URL, { headers }))
      );

      expect(yield* Effect.promise(() => read.text())).toBe("session");
      expect(handler.GET).toHaveBeenCalledOnce();
    })
  );

  it.effect.each([
    "https://nakafa.com/api/auth/callback/google?code=code&state=state",
  ])("forwards the read %s even without a session cookie", (url) =>
    Effect.gen(function* () {
      const proxy = createAuthProxy(handler);
      handler.GET.mockResolvedValueOnce(new Response("answer"));

      const read = yield* Effect.promise(() => proxy.GET(new Request(url)));

      expect(yield* Effect.promise(() => read.text())).toBe("answer");
      expect(handler.GET).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "forwards a session read with the browser host that its host header names",
    () =>
      Effect.gen(function* () {
        const proxy = createAuthProxy(handler);
        handler.GET.mockResolvedValueOnce(new Response("session"));

        yield* Effect.promise(() =>
          proxy.GET(
            new Request("http://localhost:3100/api/auth/get-session", {
              headers: { ...SESSION_COOKIE, host: "harapan.localhost:3100" },
            })
          )
        );

        const forwarded = handler.GET.mock.calls[0]?.[0];
        expect(forwarded?.url).toBe(
          "http://harapan.localhost:3100/api/auth/get-session"
        );
        expect(forwarded?.headers.get("cookie")).toBe(SESSION_COOKIE.cookie);
      })
  );

  it.effect("forwards a write with the browser host and its body", () =>
    Effect.gen(function* () {
      const proxy = createAuthProxy(handler);
      handler.POST.mockResolvedValueOnce(new Response("signed in"));

      yield* Effect.promise(() =>
        proxy.POST(
          new Request("http://localhost:3100/api/auth/sign-in/username", {
            body: '{"username":"siswa.uji"}',
            headers: { host: "harapan.localhost:3100" },
            method: "POST",
          })
        )
      );

      const forwarded = handler.POST.mock.calls[0]?.[0];
      expect(forwarded?.url).toBe(
        "http://harapan.localhost:3100/api/auth/sign-in/username"
      );
      expect(
        yield* Effect.promise(() => forwarded?.text() ?? Promise.resolve(""))
      ).toBe('{"username":"siswa.uji"}');
    })
  );

  it.effect("forwards a request that names no host with its own URL", () =>
    Effect.gen(function* () {
      const proxy = createAuthProxy(handler);
      handler.POST.mockResolvedValueOnce(new Response("signed in"));
      const request = new Request(POST_URL, { method: "POST" });

      yield* Effect.promise(() => proxy.POST(request));

      expect(handler.POST).toHaveBeenCalledWith(request);
    })
  );
});
