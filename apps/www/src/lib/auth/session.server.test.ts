// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  type Duration,
  Effect,
  Fiber,
  Option,
  Schema,
} from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import {
  readRequestSession,
  SessionUnavailable,
} from "@/lib/auth/session.server";

/** The JSON text of one body. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** The Convex site answers every read through this one fetch double. */
const fetcher = vi.fn<typeof fetch>();

process.env.VITE_CONVEX_SITE_URL = "https://example.convex.site";

const SESSION_URL = "https://example.convex.site/api/auth/get-session";
const TOKEN_URL = "https://example.convex.site/api/auth/convex/token";

/** A request from a visitor on a school host, whose cookies carry a Better Auth session. */
const signedInRequest = (host = "harapan.nakafa.com") =>
  new Request(`https://${host}/exams`, {
    headers: { cookie: "better-auth.session_token=abc" },
  });

/** A JSON answer with its status and its Set-Cookie values. */
const answer = (body: unknown, cookies: readonly string[] = [], status = 200) =>
  new Response(typeof body === "string" ? body : encodeJson(body), {
    headers: [
      ["content-type", "application/json"],
      ...Arr.map(cookies, (cookie): [string, string] => ["set-cookie", cookie]),
    ],
    status,
  });

const ada = {
  session: { id: "session-1" },
  user: { id: "user-1", name: "Ada" },
};

/** Runs the session read with the fetch double in place of the network. */
const read = (request: Request) =>
  readRequestSession(request).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

/**
 * Runs one read while the test clock passes the time its attempts and waits
 * take.
 */
const readWithin = (elapsed: Duration.Input, request = signedInRequest()) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(read(request));
    yield* TestClock.adjust(elapsed);
    return yield* Fiber.join(fiber);
  });

describe("request session", () => {
  it.effect(
    "makes no network call for a visitor without a session cookie",
    () =>
      Effect.gen(function* () {
        const session = yield* read(new Request("https://nakafa.com/"));
        expect(session.client._tag).toBe("SignedOut");
        expect(session.convexToken).toStrictEqual(Option.none());
        expect(fetcher).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "reads the signed-in user and the Convex token from the session answer",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          answer(ada, [
            "convex_jwt=token-ada; Path=/; HttpOnly",
            "better-auth.session_token=next; Path=/",
          ])
        );
        const session = yield* read(signedInRequest());
        expect(session.client).toStrictEqual({
          _tag: "SignedIn",
          name: "Ada",
          sessionId: "session-1",
          userId: "user-1",
        });
        expect(session.convexToken).toStrictEqual(Option.some("token-ada"));
        expect(session.setCookies).toStrictEqual([
          "convex_jwt=token-ada; Path=/; HttpOnly",
          "better-auth.session_token=next; Path=/",
        ]);
      })
  );

  it.effect(
    "keeps a cleared session cookie beside the fresh one of the same name",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          answer(ada, [
            "better-auth.session_token=; Max-Age=0; Path=/",
            "convex_jwt=token-ada; Path=/; HttpOnly",
            "better-auth.session_token=fresh; Path=/",
          ])
        );
        const session = yield* read(signedInRequest());
        expect(session.setCookies).toStrictEqual([
          "better-auth.session_token=; Max-Age=0; Path=/",
          "convex_jwt=token-ada; Path=/; HttpOnly",
          "better-auth.session_token=fresh; Path=/",
        ]);
      })
  );

  it.effect(
    "sends the Convex site its own host and the browser's host and scheme",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          answer(ada, ["convex_jwt=token-ada; Path=/"])
        );
        yield* read(signedInRequest("harapan.nakafa.com"));
        const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
        expect(String(fetcher.mock.calls[0]?.[0])).toBe(SESSION_URL);
        expect(headers.get("host")).toBe("example.convex.site");
        expect(headers.get("x-forwarded-host")).toBe("harapan.nakafa.com");
        expect(headers.get("x-forwarded-proto")).toBe("https");
      })
  );

  it.effect("reads the token route when the Convex cookie is cleared", () =>
    Effect.gen(function* () {
      fetcher
        .mockResolvedValueOnce(answer(ada, ["convex_jwt=; Max-Age=0; Path=/"]))
        .mockResolvedValueOnce(answer({ token: "token-route" }));
      const session = yield* read(signedInRequest());
      expect(session.convexToken).toStrictEqual(Option.some("token-route"));
    })
  );

  it.effect(
    "reads the token route when the answer carries no Convex cookie",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(answer(ada))
          .mockResolvedValueOnce(answer({ token: "token-route" }));
        const session = yield* read(signedInRequest());
        expect(session.convexToken).toStrictEqual(Option.some("token-route"));
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(String(fetcher.mock.calls[1]?.[0])).toBe(TOKEN_URL);
      })
  );

  it.effect(
    "treats a token route 401 as a session that ended, and keeps its cookies",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(
            answer(ada, ["better-auth.session_token=; Max-Age=0; Path=/"])
          )
          .mockResolvedValueOnce(new Response(null, { status: 401 }));
        const session = yield* read(signedInRequest());
        expect(session.client._tag).toBe("SignedOut");
        expect(session.convexToken).toStrictEqual(Option.none());
        expect(session.setCookies).toStrictEqual([
          "better-auth.session_token=; Max-Age=0; Path=/",
        ]);
      })
  );

  it.effect(
    "treats an empty session answer as a visitor and keeps its cookies",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          answer(null, ["better-auth.session_token=; Max-Age=0; Path=/"])
        );
        const session = yield* read(signedInRequest());
        expect(session.client._tag).toBe("SignedOut");
        expect(session.setCookies).toStrictEqual([
          "better-auth.session_token=; Max-Age=0; Path=/",
        ]);
        expect(fetcher).toHaveBeenCalledTimes(1);
      })
  );

  it.effect("fails at once with the status of a refused session read", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(answer({}, [], 400));
      const error = yield* Effect.flip(read(signedInRequest()));
      expect(error).toStrictEqual(
        new SessionUnavailable({ reason: "status", status: 400 })
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("retries a 5xx session read, then returns the session", () =>
    Effect.gen(function* () {
      fetcher
        .mockResolvedValueOnce(answer({}, [], 503))
        .mockResolvedValueOnce(answer(ada, ["convex_jwt=token-ada; Path=/"]));
      // The retry waits 500 milliseconds.
      const session = yield* readWithin("500 millis");
      expect(session.client._tag).toBe("SignedIn");
      expect(fetcher).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("fails with the status after three 5xx session reads", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(async () => answer({}, [], 500));
      const error = yield* readWithin("1500 millis").pipe(Effect.flip);
      expect(error).toStrictEqual(
        new SessionUnavailable({ reason: "status", status: 500 })
      );
      expect(fetcher).toHaveBeenCalledTimes(3);
    })
  );

  it.effect(
    "retries an attempt that misses its deadline, then fails with the deadline",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(
          () => new Promise<Response>(() => undefined)
        );
        // Three attempts of ten seconds, with the 500 ms and 1 s waits between.
        const error = yield* readWithin("31500 millis").pipe(Effect.flip);
        expect(error).toStrictEqual(
          new SessionUnavailable({ reason: "deadline" })
        );
        expect(fetcher).toHaveBeenCalledTimes(3);
      })
  );

  it.effect("fails with the status of a refused token route", () =>
    Effect.gen(function* () {
      fetcher
        .mockResolvedValueOnce(answer(ada))
        .mockResolvedValueOnce(new Response(null, { status: 400 }));
      const error = yield* Effect.flip(read(signedInRequest()));
      expect(error).toStrictEqual(
        new SessionUnavailable({ reason: "status", status: 400 })
      );
    })
  );

  it.effect(
    "fails with a fetch reason when the body breaks while it is read",
    () =>
      Effect.gen(function* () {
        const broken = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.error(new Error("reset"));
          },
        });
        fetcher.mockResolvedValueOnce(new Response(broken, { status: 200 }));
        const error = yield* Effect.flip(read(signedInRequest()));
        expect(error).toStrictEqual(
          new SessionUnavailable({ reason: "fetch" })
        );
      })
  );

  it.effect("fails with a fetch reason when the network breaks", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValueOnce(new Error("offline"));
      const error = yield* Effect.flip(read(signedInRequest()));
      expect(error).toStrictEqual(new SessionUnavailable({ reason: "fetch" }));
      expect(fetcher).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "fails with a body reason when the session answer is not JSON of the session",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(answer("not json"));
        const error = yield* Effect.flip(read(signedInRequest()));
        expect(error).toStrictEqual(new SessionUnavailable({ reason: "body" }));
      })
  );

  it.effect(
    "fails with a body reason when the token route answers without a token",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(answer(ada))
          .mockResolvedValueOnce(answer({ other: true }));
        const error = yield* Effect.flip(read(signedInRequest()));
        expect(error).toStrictEqual(new SessionUnavailable({ reason: "body" }));
      })
  );
});
