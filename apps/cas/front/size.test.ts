import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import {
  CasRequestTooLarge,
  CasRequestUnreadable,
  readBoundedBody,
} from "@/front/size";

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe("readBoundedBody", () => {
  it.effect("reads an absent body as empty", () =>
    Effect.gen(function* () {
      const body = yield* readBoundedBody(null, 4);

      expect(body.byteLength).toBe(0);
    })
  );

  it.effect("joins the chunks of a body within the limit", () =>
    Effect.gen(function* () {
      const body = yield* readBoundedBody(
        streamOf(new Uint8Array([1, 2]), new Uint8Array([3])),
        3
      );

      expect([...body]).toEqual([1, 2, 3]);
    })
  );

  it.effect("refuses a body that crosses the limit", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        readBoundedBody(
          streamOf(new Uint8Array([1, 2]), new Uint8Array([3, 4])),
          3
        )
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(CasRequestTooLarge);
        expect(result.failure).toMatchObject({ limit: 3 });
      }
    })
  );

  it.effect("reports a stream that fails while it is read", () =>
    Effect.gen(function* () {
      const failing = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(new Error("connection reset"));
        },
      });
      const result = yield* Effect.result(readBoundedBody(failing, 3));

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(CasRequestUnreadable);
      }
    })
  );

  it.effect("reports a stream that fails when it is cancelled", () =>
    Effect.gen(function* () {
      const failing = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
        },
        cancel() {
          throw new Error("cancel refused");
        },
      });
      const result = yield* Effect.result(readBoundedBody(failing, 3));

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(CasRequestTooLarge);
      }
    })
  );
});
