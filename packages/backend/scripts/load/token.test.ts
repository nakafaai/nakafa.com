import { afterEach, describe, expect, it } from "@effect/vitest";
import { seatTokens } from "@repo/backend/scripts/load/token";
import { Array as Arr, Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

const DEPLOYMENT = "http://127.0.0.1:3210";
const SEAT = { token: "seat-token-1", userId: "user-1" };

const encodeJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);
const decodeJson = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** One answer of the deployment's HTTP API: a function's value, as JSON. */
const answer = (value: unknown, status = 200) =>
  new Response(encodeJson({ status: "success", value }), {
    headers: { "content-type": "application/json" },
    status,
  });

/** The tokens of a session, numbered by the sign-in or refresh that issued them. */
const tokens = (round: number) => ({
  accessToken: `access-${round}`,
  refreshToken: `refresh-${round}`,
});

/** The access-token source of the test seat, asking through the controlled fetch. */
const source = seatTokens(DEPLOYMENT, SEAT).pipe(
  Effect.map((ask) =>
    ask.pipe(Effect.provideService(FetchHttpClient.Fetch, fetcher))
  )
);

/** The path and arguments of each mutation the seat called, in order. */
const calledMutations = () =>
  Arr.map(fetcher.mock.calls, ([request, init]) => ({
    body: decodeJson(String(init?.body)),
    url: String(request),
  }));

describe("load token", () => {
  afterEach(() => {
    fetcher.mockReset();
  });

  it.effect(
    "signs the seat in once with its password, then refreshes the session at every later ask",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(
            answer({ status: "complete", tokens: tokens(1) })
          )
          .mockResolvedValueOnce(answer({ kind: "rotated", tokens: tokens(2) }))
          .mockResolvedValueOnce(
            answer({ kind: "rotated", tokens: tokens(3) })
          );
        const ask = yield* source;
        expect([yield* ask, yield* ask, yield* ask]).toEqual([
          "access-1",
          "access-2",
          "access-3",
        ]);
        expect(calledMutations()).toEqual([
          {
            body: {
              args: { password: "seat-token-1", username: "user-1" },
              format: "json",
              path: "auth/core:signInWithUsernamePassword",
            },
            url: `${DEPLOYMENT}/api/mutation`,
          },
          {
            body: {
              args: { refreshToken: "refresh-1" },
              format: "json",
              path: "auth/core:refreshSession",
            },
            url: `${DEPLOYMENT}/api/mutation`,
          },
          {
            body: {
              args: { refreshToken: "refresh-2" },
              format: "json",
              path: "auth/core:refreshSession",
            },
            url: `${DEPLOYMENT}/api/mutation`,
          },
        ]);
      })
  );

  it.effect("answers no token once the session is gone", () =>
    Effect.gen(function* () {
      fetcher
        .mockResolvedValueOnce(
          answer({ status: "complete", tokens: tokens(1) })
        )
        .mockResolvedValueOnce(answer({ kind: "noSession" }));
      const ask = yield* source;
      yield* ask;
      expect(yield* ask).toBeNull();
    })
  );

  it.effect(
    "fails with the status of a refused request, an unreadable or refused answer, or no answer",
    () =>
      Effect.gen(function* () {
        const ask = yield* source;
        fetcher.mockResolvedValueOnce(new Response("busy", { status: 429 }));
        expect(yield* Effect.flip(ask)).toMatchObject({
          _tag: "TokenFailed",
          status: 429,
        });
        fetcher.mockResolvedValueOnce(new Response("not json"));
        expect(yield* Effect.flip(ask)).toMatchObject({ status: 200 });
        fetcher.mockResolvedValueOnce(
          answer({
            status: "error",
            userError: { error: "INVALID_CREDENTIALS" },
          })
        );
        expect(yield* Effect.flip(ask)).toMatchObject({ status: 200 });
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));
        expect(yield* Effect.flip(ask)).toMatchObject({ status: 0 });
      })
  );
});
