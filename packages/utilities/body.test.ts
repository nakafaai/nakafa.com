import { describe, expect, it } from "@effect/vitest";
import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { Deferred, Effect, Fiber } from "effect";
import { vi } from "vitest";

/** Builds one bounded body read for the Effect test runtime. */
function read(body: ReadableStream<Uint8Array> | null, maxBytes = 8) {
  return readBoundedBody(body, maxBytes);
}
/** Returns one typed body failure in the Effect test runtime. */
function reject(body: ReadableStream<Uint8Array> | null, maxBytes = 8) {
  return readBoundedBody(body, maxBytes).pipe(Effect.flip);
}
describe("bounded response body", () => {
  it.effect.each([
    { expected: null, value: null },
    { expected: 0, value: "0" },
    { expected: 8, value: "0008" },
    { expected: 8, value: "8" },
  ] as const)("parses the optional Content-Length %s", ({ expected, value }) =>
    Effect.gen(function* () {
      expect(yield* parseContentLength(value, 8)).toBe(expected);
    })
  );
  it.effect.each(["", " 1", "-1", "+1", "1.0", "1, 1", "9".repeat(400)])(
    "rejects the malformed Content-Length %s",
    (value) =>
      Effect.gen(function* () {
        expect(
          yield* parseContentLength(value, 8).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "BodyLengthError",
          reason: "invalid",
        });
      })
  );
  it.effect("rejects a declared Content-Length above its caller ceiling", () =>
    Effect.gen(function* () {
      expect(yield* parseContentLength("9", 8).pipe(Effect.flip)).toMatchObject(
        {
          _tag: "BodyLengthError",
          reason: "limit",
        }
      );
    })
  );
  it.effect("concatenates ordered chunks without exceeding the ceiling", () =>
    Effect.gen(function* () {
      const stream = new ReadableStream<Uint8Array>({
        /** Emits two chunks to prove stable byte ordering. */
        start(controller) {
          controller.enqueue(new TextEncoder().encode("ab"));
          controller.enqueue(new TextEncoder().encode("cd"));
          controller.close();
        },
      });
      expect(yield* read(stream)).toEqual(new TextEncoder().encode("abcd"));
    })
  );
  it.effect("rejects missing and unreadable bodies", () =>
    Effect.gen(function* () {
      const unreadable = new ReadableStream<Uint8Array>();
      Object.defineProperty(unreadable, "getReader", {
        /** Simulates an acquisition race after the stream appeared unlocked. */
        value() {
          throw new TypeError("reader unavailable");
        },
      });
      expect(yield* reject(null)).toMatchObject({
        _tag: "BodyMissingError",
      });
      expect(yield* reject(unreadable)).toMatchObject({
        _tag: "BodyReadError",
      });
    })
  );
  it.effect("maps stream failures to a typed read error", () =>
    Effect.gen(function* () {
      const stream = new ReadableStream<Uint8Array>({
        /** Fails before exposing response bytes. */
        pull(controller) {
          controller.error(new TypeError("private detail"));
        },
      });
      expect(yield* reject(stream)).toMatchObject({
        _tag: "BodyReadError",
      });
    })
  );
  it.effect("cancels an unfinished reader when its Effect is interrupted", () =>
    Effect.gen(function* () {
      const pullStarted = yield* Deferred.make<void>();
      const cancel = vi.fn();
      const stream = new ReadableStream<Uint8Array>({
        cancel,
        /** Marks the native reader as active without completing its read. */
        pull() {
          Deferred.doneUnsafe(pullStarted, Effect.void);
        },
      });
      const fiber = yield* readBoundedBody(stream, 8).pipe(
        Effect.forkChild({ startImmediately: true })
      );
      yield* Deferred.await(pullStarted);
      yield* Fiber.interrupt(fiber);
      expect(cancel).toHaveBeenCalledOnce();
    })
  );
  it.effect.each([false, true])(
    "cancels an oversized body even when cancellation rejects: %s",
    (rejectCancellation) =>
      Effect.gen(function* () {
        const cancel = vi.fn(() => {
          if (rejectCancellation) {
            return Promise.reject(new TypeError("cancel failed"));
          }
        });
        const stream = new ReadableStream<Uint8Array>({
          cancel,
          /** Emits one oversized chunk before provider cancellation. */
          pull(controller) {
            controller.enqueue(new TextEncoder().encode("oversized"));
          },
        });
        expect(yield* reject(stream, 4)).toMatchObject({
          _tag: "BodyLimitError",
          actualBytes: 9,
          maxBytes: 4,
        });
        expect(cancel).toHaveBeenCalledOnce();
      })
  );
});
