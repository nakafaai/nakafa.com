// @vitest-environment node
import { readJsonBody } from "@repo/backend/convex/contentRelease/http/body";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Result } from "effect";

/** Reads one request at the Vitest boundary while preserving typed failures. */
function read(request: Request, maxBytes = 8) {
  return readJsonBody(request, maxBytes).pipe(Effect.result);
}
/** Creates one Node request with a streaming body. */
function streamRequest(
  body: ReadableStream<Uint8Array>,
  headers?: HeadersInit
) {
  const request = {
    body,
    duplex: "half",
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  } satisfies RequestInit & {
    readonly duplex: "half";
  };
  return new Request("https://example.test/internal", request);
}
describe("content release HTTP body", () => {
  it.live("accepts JSON media types and one exact UTF-8 body", () =>
    Effect.gen(function* () {
      const source = '"é"';
      const request = new Request("https://example.test/internal", {
        body: source,
        headers: {
          "content-length": "4",
          "content-type": "application/json; charset=utf-8",
        },
        method: "POST",
      });
      expect(yield* read(request)).toEqual(
        Result.succeed({ byteLength: 4, source })
      );
    })
  );
  it.live("accepts an explicitly empty request body", () =>
    Effect.gen(function* () {
      const request = new Request("https://example.test/internal", {
        headers: {
          "content-length": "0",
          "content-type": "application/json",
        },
        method: "POST",
      });
      expect(yield* read(request)).toEqual(
        Result.succeed({ byteLength: 0, source: "" })
      );
    })
  );
  it.live.each([
    ["not-decimal", "invalid"],
    ["999999999999999999999", "invalid"],
    ["9", "size"],
  ] as const)(
    "rejects the declared length %s as %s",
    ([contentLength, reason]) =>
      Effect.gen(function* () {
        const request = new Request("https://example.test/internal", {
          headers: {
            "content-length": contentLength,
            "content-type": "application/json",
          },
          method: "POST",
        });
        expect(yield* read(request)).toMatchObject({
          _tag: "Failure",
          failure: { reason },
        });
      })
  );
  it.live("rejects unsupported content before consuming its stream", () =>
    Effect.gen(function* () {
      let pulls = 0;
      const request = streamRequest(
        new ReadableStream(
          {
            /** Records any unexpected attempt to consume an unsupported body. */
            pull() {
              pulls += 1;
            },
          },
          { highWaterMark: 0 }
        ),
        { "content-type": "text/plain" }
      );
      expect(yield* read(request)).toMatchObject({
        _tag: "Failure",
        failure: { reason: "unsupported" },
      });
      expect(pulls).toBe(0);
    })
  );
  it.live.each([
    "application/json-seq",
    "application/json; charset=iso-8859-1",
    'application/json; charset="utf-8"',
    "application/json; charset=utf-8; version=1",
  ])("rejects the unsupported JSON media type %s", (contentType) =>
    Effect.gen(function* () {
      const request = new Request("https://example.test/internal", {
        body: "{}",
        headers: { "content-type": contentType },
        method: "POST",
      });
      expect(yield* read(request)).toMatchObject({
        _tag: "Failure",
        failure: { reason: "unsupported" },
      });
    })
  );
  it.live("rejects absent, mismatched, and oversized bodies", () =>
    Effect.gen(function* () {
      const absent = new Request("https://example.test/internal", {
        headers: {
          "content-length": "1",
          "content-type": "application/json",
        },
        method: "POST",
      });
      const mismatched = new Request("https://example.test/internal", {
        body: "{}",
        headers: {
          "content-length": "3",
          "content-type": "application/json",
        },
        method: "POST",
      });
      let cancelled = false;
      const oversized = streamRequest(
        new ReadableStream({
          /** Records cancellation after the reader reaches its byte limit. */
          cancel() {
            cancelled = true;
          },
          /** Enqueues a body larger than the configured test limit. */
          start(controller) {
            controller.enqueue(new TextEncoder().encode("123456789"));
          },
        })
      );
      for (const [request, reason] of [
        [absent, "invalid"],
        [mismatched, "invalid"],
        [oversized, "size"],
      ] as const) {
        expect(yield* read(request)).toMatchObject({
          _tag: "Failure",
          failure: { reason },
        });
      }
      expect(cancelled).toBe(true);
    })
  );
  it.live("rejects stream failures and malformed UTF-8", () =>
    Effect.gen(function* () {
      const failed = streamRequest(
        new ReadableStream({
          /** Fails the request stream on its first read. */
          pull(controller) {
            controller.error(new Error("stream failed"));
          },
        })
      );
      const malformed = streamRequest(
        new ReadableStream({
          /** Enqueues an invalid UTF-8 sequence and closes the stream. */
          start(controller) {
            controller.enqueue(new Uint8Array([0xc3, 0x28]));
            controller.close();
          },
        })
      );
      for (const request of [failed, malformed]) {
        expect(yield* read(request)).toMatchObject({
          _tag: "Failure",
          failure: { reason: "invalid" },
        });
      }
    })
  );
});
