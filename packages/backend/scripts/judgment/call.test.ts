import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { callMeasure } from "@repo/backend/scripts/judgment/call";
import { Array as Arr, Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";

const config = { accessToken: "test-token", url: "https://test.convex.cloud" };
const names = ["ownNote", "private"] as const;
const texts = [
  "Note: Kelas 12\nQuote: Aku kelas 12",
  "Note: Terima kasih\nQuote: Makasih",
];

/** What the action answers for those two texts. */
const measurement = {
  rows: [
    { probabilities: { ownNote: 0.95, private: 0.02 } },
    { failure: { reason: "invalid", status: 400 } },
  ],
  thresholds: { ownNote: 0.5, private: 0.5 },
};

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/** Calls the action through the controlled fetch. */
function call() {
  return callMeasure(config, names, texts, 2).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

beforeEach(() => {
  fetcher.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("the call to the measuring action", () => {
  it.effect(
    "sends one authenticated action call to the deployment the credential names, and reads the measurement",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          Response.json({ status: "success", value: measurement })
        );
        expect(yield* call()).toEqual(measurement);
        expect(fetcher).toHaveBeenCalledExactlyOnceWith(
          new URL("https://test.convex.cloud/api/action"),
          expect.objectContaining({
            headers: {
              authorization: "Convex test-token",
              "content-type": "application/json",
            },
            method: "POST",
          })
        );
        expect(
          yield* Effect.promise(
            (): Promise<unknown> =>
              new Response(fetcher.mock.calls[0]?.[1]?.body).json()
          )
        ).toEqual({
          args: { names, texts, together: 2 },
          format: "json",
          path: "nina/judgment:measure",
        });
      })
  );

  it.effect("fails at the 60 second deadline", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(() => new Promise<Response>(() => undefined));
      const fiber = yield* Effect.forkChild(Effect.flip(call()));
      yield* TestClock.adjust("60 seconds");
      expect(yield* Fiber.join(fiber)).toMatchObject({
        _tag: "JudgmentCallError",
        message: "Convex did not answer within 60 seconds.",
      });
    })
  );

  it.effect.each([0, 1, 3])(
    "refuses an answer of %s rows for two texts, so that no row is matched with the wrong text",
    (count) =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          Response.json({
            status: "success",
            value: {
              ...measurement,
              rows: Arr.take(Arr.replicate(measurement.rows[0], 3), count),
            },
          })
        );
        expect(yield* Effect.flip(call())).toMatchObject({
          _tag: "JudgmentCallError",
          message: `nina/judgment:measure: the deployment measured ${count} of 2 texts`,
        });
      })
  );

  it.effect.each([
    {
      body: { status: "unknown" },
      message:
        "nina/judgment:measure: the answer is not what the command reads",
    },
    {
      body: { status: "success", value: { rows: "none" } },
      message:
        "nina/judgment:measure: the answer is not what the command reads",
    },
    {
      body: { errorMessage: "Access denied", status: "error" },
      message: "nina/judgment:measure: Access denied",
    },
    {
      body: { status: "error" },
      message: "nina/judgment:measure: Unknown Convex error",
    },
  ])("rejects an answer it cannot use: $message", ({ body, message }) =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(Response.json(body));
      expect(yield* Effect.flip(call())).toMatchObject({
        _tag: "JudgmentCallError",
        message,
      });
    })
  );

  it.effect.each([
    { message: "offline", response: undefined },
    {
      message: "nina/judgment:measure: HTTP 401",
      response: new Response("unauthorized", { status: 401 }),
    },
    { message: "JSON", response: new Response("{") },
  ])(
    "preserves a transport failure as a typed error: $message",
    ({ message, response }) =>
      Effect.gen(function* () {
        if (response === undefined) {
          fetcher.mockRejectedValue(new Error("offline"));
        } else {
          fetcher.mockResolvedValue(response);
        }
        expect(yield* Effect.flip(call())).toMatchObject({
          _tag: "JudgmentCallError",
          message: expect.stringContaining(message),
        });
      })
  );
});
