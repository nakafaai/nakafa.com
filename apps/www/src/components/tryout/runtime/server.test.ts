import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { readServerClockOffset } from "@/components/tryout/runtime/server";

const fetcher = vi.fn<typeof fetch>();

/** The moment the device's clock reads at the send. */
const DEVICE_NOW = Date.UTC(2026, 10, 1, 12, 0, 0);

/** An answer whose Date header names the moment `serverAt` in whole seconds. */
function answerAt(serverAt: number) {
  return new Response(null, {
    headers: { date: new Date(serverAt).toUTCString() },
  });
}

/** Reads the correction with the device's clock at `DEVICE_NOW`. */
const read = Effect.gen(function* () {
  yield* TestClock.setTime(DEVICE_NOW);
  return yield* readServerClockOffset().pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
});

describe("tryout/runtime/server", () => {
  it.effect("corrects a device whose clock runs behind the server", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(answerAt(DEVICE_NOW + 600_000));

      expect(yield* read).toBe(600_500);
    })
  );

  it.effect("corrects a device whose clock runs ahead of the server", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(answerAt(DEVICE_NOW - 600_000));

      expect(yield* read).toBe(-599_500);
    })
  );

  it.effect("leaves a clock alone inside the header's own rounding", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(answerAt(DEVICE_NOW + 1000));

      expect(yield* read).toBe(0);
    })
  );

  it.effect("keeps the device's clock when an answer names no time", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response(null));

      expect(yield* read).toBe(0);
    })
  );

  it.effect("keeps the device's clock when the read fails", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValueOnce(new TypeError("offline"));

      expect(yield* read).toBe(0);
    })
  );

  it.effect("keeps the device's clock when the read never answers", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DEVICE_NOW);
      fetcher.mockImplementationOnce(() => new Promise(() => undefined));
      const reading = yield* Effect.forkChild(
        readServerClockOffset().pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        )
      );
      yield* TestClock.adjust("5 seconds");

      expect(yield* Fiber.join(reading)).toBe(0);
    })
  );
});
