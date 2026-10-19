// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import {
  readRequestSession,
  SessionUnavailable,
} from "@/lib/auth/session.server";

/** The JSON text of one body. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** The Convex site answers every read through this one fetch double. */
const fetcher = vi.fn<typeof fetch>();

process.env.VITE_CONVEX_SITE_URL = "https://example.convex.site";

/** Request headers that carry a Better Auth session cookie. */
const signedInRequest = () =>
  new Headers({ cookie: "better-auth.session_token=abc" });

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
const read = (headers: Headers) =>
  readRequestSession(headers).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

describe("request session", () => {
  it.effect(
    "makes no network call for a visitor without a session cookie",
    () =>
      Effect.gen(function* () {
        const session = yield* read(new Headers());
        expect(session.client._tag).toBe("SignedOut");
        expect(session.convexToken).toBeNull();
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
        expect(session.convexToken).toBe("token-ada");
        expect(session.setCookies).toHaveLength(2);
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
        expect(session.convexToken).toBe("token-route");
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect("treats an empty session answer as a visitor", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(answer(null));
      const session = yield* read(signedInRequest());
      expect(session.client._tag).toBe("SignedOut");
      expect(fetcher).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("fails with a status when the session route refuses", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(answer({}, [], 500));
      const error = yield* Effect.flip(read(signedInRequest()));
      expect(error).toEqual(
        new SessionUnavailable({ reason: "status", status: 500 })
      );
    })
  );

  it.effect("fails with a fetch reason when the network breaks", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValueOnce(new Error("offline"));
      const error = yield* Effect.flip(read(signedInRequest()));
      expect(error).toEqual(new SessionUnavailable({ reason: "fetch" }));
    })
  );

  it.effect(
    "fails with a body reason when the session answer is not JSON of the session",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(answer("not json"));
        const error = yield* Effect.flip(read(signedInRequest()));
        expect(error).toEqual(new SessionUnavailable({ reason: "body" }));
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
        expect(error).toEqual(new SessionUnavailable({ reason: "body" }));
      })
  );
});
