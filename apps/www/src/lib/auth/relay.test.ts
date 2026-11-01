// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { createAuthProxy } from "@/lib/auth/relay";

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

describe("createAuthProxy", () => {
  it.effect.each([
    [
      "the Google callback that signs in",
      "GET",
      "https://nakafa.com/api/auth/callback/google?code=one-time",
      "__Secure-better-auth.session_token=token.signature; Path=/",
      "nakafa-signed-in=1;",
    ],
    [
      "the write that signs out",
      "POST",
      "https://nakafa.com/api/auth/sign-out",
      "__Secure-better-auth.session_token=; Max-Age=0; Path=/",
      "nakafa-signed-in=;",
    ],
  ] as const)("keeps the hint on %s", ([, method, url, cookie, hint]) =>
    Effect.gen(function* () {
      vi.stubEnv("SITE_URL", "https://nakafa.com");
      const answer = new Response(null, {
        headers: { "set-cookie": cookie },
        status: 200,
      });
      handler.GET.mockResolvedValueOnce(answer.clone());
      handler.POST.mockResolvedValueOnce(answer.clone());
      const send = createAuthProxy(handler)[method];

      const response = yield* Effect.promise(() =>
        send(
          new Request(url, {
            headers: SECURE_SESSION_COOKIE,
            method,
          })
        )
      );

      expect(response.headers.getSetCookie()).toStrictEqual([
        cookie,
        expect.stringContaining(hint),
      ]);
    })
  );

  it.effect(
    "rejects a write whose network failure is not repeated, so the server answers 500, after logging it",
    () =>
      Effect.gen(function* () {
        handler.POST.mockRejectedValueOnce(networkFailure("ECONNRESET"));

        const failed = yield* Effect.tryPromise(() =>
          createAuthProxy(handler).POST(
            new Request("https://nakafa.com/api/auth/delete-user", {
              method: "POST",
            })
          )
        ).pipe(Effect.flip);

        expect(failed).toBeInstanceOf(Error);
        expect(handler.POST).toHaveBeenCalledOnce();
      })
  );

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

  it.effect.each([
    ["no length", {}],
    ["a length of zero", { "content-length": "0" }],
  ] as const)(
    "gives a session refresh with %s the JSON body Better Auth takes",
    ([, headers]) =>
      Effect.gen(function* () {
        const proxy = createAuthProxy(handler);
        handler.POST.mockResolvedValueOnce(new Response(null));

        yield* Effect.promise(() =>
          proxy.POST(
            new Request(GET_URL, {
              headers: { ...SESSION_COOKIE, ...headers },
              method: "POST",
            })
          )
        );

        const forwarded = handler.POST.mock.calls[0]?.[0];
        expect(forwarded?.headers.get("content-type")).toBe("application/json");
        expect(forwarded?.headers.get("cookie")).toBe(SESSION_COOKIE.cookie);
        expect(
          yield* Effect.promise(() => forwarded?.text() ?? Promise.resolve(""))
        ).toBe("{}");
      })
  );

  it.effect.each([
    ["names its media type", { "content-type": "text/plain" }],
    ["declares a length", { "content-length": "4" }],
  ] as const)("keeps the body of a write that %s", ([, headers]) =>
    Effect.gen(function* () {
      const proxy = createAuthProxy(handler);
      handler.POST.mockResolvedValueOnce(new Response(null));

      yield* Effect.promise(() =>
        proxy.POST(
          new Request(POST_URL, { body: "body", headers, method: "POST" })
        )
      );

      const forwarded = handler.POST.mock.calls[0]?.[0];
      expect(
        yield* Effect.promise(() => forwarded?.text() ?? Promise.resolve(""))
      ).toBe("body");
    })
  );

  it.effect("forwards a request that names no host with its own URL", () =>
    Effect.gen(function* () {
      const proxy = createAuthProxy(handler);
      handler.POST.mockResolvedValueOnce(new Response("signed in"));
      const request = new Request(POST_URL, {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      yield* Effect.promise(() => proxy.POST(request));

      expect(handler.POST).toHaveBeenCalledWith(request);
    })
  );
});
