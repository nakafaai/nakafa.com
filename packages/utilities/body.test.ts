import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { Effect, Either, Fiber } from "effect";
import { describe, expect, it, vi } from "vitest";

/** Runs one bounded body read at the test boundary. */
function read(body: ReadableStream<Uint8Array> | null, maxBytes = 8) {
  return Effect.runPromise(readBoundedBody(body, maxBytes));
}

/** Returns one typed body failure at the test boundary. */
function reject(body: ReadableStream<Uint8Array> | null, maxBytes = 8) {
  return Effect.runPromise(readBoundedBody(body, maxBytes).pipe(Effect.flip));
}

describe("bounded response body", () => {
  it.each([
    [null, null],
    ["0", 0],
    ["0008", 8],
    ["8", 8],
  ] as const)(
    "parses the optional Content-Length %s",
    async (value, expected) => {
      await expect(
        Effect.runPromise(parseContentLength(value, 8))
      ).resolves.toBe(expected);
    }
  );

  it.each(["", " 1", "-1", "+1", "1.0", "1, 1", "9".repeat(400)])(
    "rejects the malformed Content-Length %s",
    async (value) => {
      await expect(
        Effect.runPromise(parseContentLength(value, 8).pipe(Effect.either))
      ).resolves.toEqual(
        Either.left({ _tag: "BodyLengthError", reason: "invalid" })
      );
    }
  );

  it("rejects a declared Content-Length above its caller ceiling", async () => {
    await expect(
      Effect.runPromise(parseContentLength("9", 8).pipe(Effect.either))
    ).resolves.toEqual(
      Either.left({ _tag: "BodyLengthError", reason: "limit" })
    );
  });

  it("concatenates ordered chunks without exceeding the ceiling", async () => {
    const stream = new ReadableStream<Uint8Array>({
      /** Emits two chunks to prove stable byte ordering. */
      start(controller) {
        controller.enqueue(new TextEncoder().encode("ab"));
        controller.enqueue(new TextEncoder().encode("cd"));
        controller.close();
      },
    });

    await expect(read(stream)).resolves.toEqual(
      new TextEncoder().encode("abcd")
    );
  });

  it("rejects missing and unreadable bodies", async () => {
    const locked = new ReadableStream<Uint8Array>();
    locked.getReader();

    await expect(reject(null)).resolves.toMatchObject({
      _tag: "BodyMissingError",
    });
    await expect(reject(locked)).resolves.toMatchObject({
      _tag: "BodyReadError",
    });
  });

  it("maps stream failures to a typed read error", async () => {
    const stream = new ReadableStream<Uint8Array>({
      /** Fails before exposing response bytes. */
      pull(controller) {
        controller.error(new TypeError("private detail"));
      },
    });

    await expect(reject(stream)).resolves.toMatchObject({
      _tag: "BodyReadError",
    });
  });

  it("cancels an unfinished reader when its Effect is interrupted", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const fiber = Effect.runFork(readBoundedBody(stream, 8));

    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "cancels an oversized body even when cancellation rejects: %s",
    async (rejectCancellation) => {
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

      await expect(reject(stream, 4)).resolves.toMatchObject({
        _tag: "BodyLimitError",
        actualBytes: 9,
        maxBytes: 4,
      });
      expect(cancel).toHaveBeenCalledOnce();
    }
  );
});
