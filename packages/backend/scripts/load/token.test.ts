import { afterEach, describe, expect, it } from "@effect/vitest";
import { LOCAL_AUTH_SECRET } from "@repo/backend/scripts/content/acceptance/auth";
import { issueToken, sessionCookie } from "@repo/backend/scripts/load/token";
import { makeSignature } from "better-auth/crypto";
import { Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

const SITE = "http://127.0.0.1:3211";

const encodeJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** Asks for one token through the controlled fetch. */
const issue = (cookie: string) =>
  issueToken(SITE, cookie).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

describe("load token", () => {
  afterEach(() => {
    fetcher.mockReset();
  });

  it.effect(
    "signs a session cookie with the runtime's secret, as a browser holds it",
    () =>
      Effect.gen(function* () {
        const signature = yield* Effect.promise(() =>
          makeSignature("session-1", LOCAL_AUTH_SECRET)
        );
        expect(yield* sessionCookie("session-1")).toBe(
          `better-auth.session_token=${encodeURIComponent(`session-1.${signature}`)}`
        );
      })
  );

  it.effect(
    "asks the Convex site's token route with the cookie and returns the token",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          new Response(encodeJson({ token: "jwt" }), {
            headers: { "content-type": "application/json" },
          })
        );
        expect(yield* issue("better-auth.session_token=abc")).toBe("jwt");
        const [request] = fetcher.mock.calls[0] ?? [];
        expect(String(request)).toBe(`${SITE}/api/auth/convex/token`);
        const init = fetcher.mock.calls[0]?.[1];
        expect(new Headers(init?.headers).get("cookie")).toBe(
          "better-auth.session_token=abc"
        );
      })
  );

  it.effect(
    "fails with the status of a refused request, an unreadable body, or no answer",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(new Response("busy", { status: 429 }));
        expect(yield* Effect.flip(issue("c"))).toMatchObject({
          _tag: "TokenFailed",
          status: 429,
        });
        fetcher.mockResolvedValueOnce(new Response("not json"));
        expect(yield* Effect.flip(issue("c"))).toMatchObject({ status: 200 });
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));
        expect(yield* Effect.flip(issue("c"))).toMatchObject({ status: 0 });
      })
  );
});
