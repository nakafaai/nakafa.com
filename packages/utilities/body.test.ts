import { describe, expect, it } from "@repo/testing/effect";
import {
  parseContentLength,
  readBoundedBody,
  readBoundedBodyResult,
} from "@repo/utilities/body";
import { Effect, Fiber, Result } from "effect";
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
  it("exposes the same bounded result without starting a runtime", async () => {
    const stream = new ReadableStream<Uint8Array>({
      /** Emits one direct-boundary chunk. */
      start(controller) {
        controller.enqueue(new TextEncoder().encode("direct"));
        controller.close();
      },
    });
    await expect(readBoundedBodyResult(stream, 8)).resolves.toEqual(
      Result.succeed(new TextEncoder().encode("direct"))
    );
  });
  it.effect("rejects missing and unreadable bodies", () =>
    Effect.gen(function* () {
      const locked = new ReadableStream<Uint8Array>();
      locked.getReader();
      expect(yield* reject(null)).toMatchObject({
        _tag: "BodyMissingError",
      });
      expect(yield* reject(locked)).toMatchObject({
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
      let markCancelled: () => void = () => undefined;
      const cancelled = new Promise<void>((resolve) => {
        markCancelled = resolve;
      });
      const cancel = vi.fn(markCancelled);
      let markPullStarted: () => void = () => undefined;
      const pullStarted = new Promise<void>((resolve) => {
        markPullStarted = resolve;
      });
      const stream = new ReadableStream<Uint8Array>({
        cancel,
        pull: markPullStarted,
      });
      const fiber = yield* Effect.forkChild(readBoundedBody(stream, 8));
      yield* Effect.promise(() => pullStarted);
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(fiber);
      yield* Effect.promise(() => cancelled);
      expect(cancel).toHaveBeenCalledOnce();
    })
  );
  it.effect.each([false, true])(
    "cancels an oversized body even when cancellation rejects: %s",
    (rejectCancellation) =>
      Effect.gen(function* () {
        const cancel = vi.fn(() =>
          rejectCancellation
            ? Promise.reject(new TypeError("cancel failed"))
            : Promise.resolve()
        );
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
