// @vitest-environment node

import {
  MAX_MCP_REQUEST_BYTES,
  readMcpRequest,
} from "@repo/backend/convex/routes/agent/mcp/input";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

/** Creates one Node request whose stream has no declared byte length. */
function streamRequest(body: ReadableStream<Uint8Array>) {
  const init = {
    body,
    duplex: "half",
    headers: { "content-type": "application/json" },
    method: "POST",
  } satisfies RequestInit & { readonly duplex: "half" };
  return new Request("https://example.test/internal/mcp", init);
}

describe("MCP request input", () => {
  it.live("accepts the exact policy ceiling and parses the body once", () =>
    Effect.gen(function* () {
      const source = `"${"a".repeat(MAX_MCP_REQUEST_BYTES - 2)}"`;
      const result = yield* readMcpRequest(
        new Request("https://example.test/internal/mcp", {
          body: source,
          headers: { "content-type": "application/json" },
          method: "POST",
        })
      );

      expect(result.parsedBody).toBe(source.slice(1, -1));
      expect(yield* Effect.promise(() => result.request.text())).toBe(source);
    })
  );

  it.live("rejects an oversized declaration without consuming the body", () =>
    Effect.gen(function* () {
      let pulls = 0;
      const request = streamRequest(
        new ReadableStream(
          {
            /** Records any unexpected stream consumption. */
            pull() {
              pulls += 1;
            },
          },
          { highWaterMark: 0 }
        )
      );
      request.headers.set("content-length", String(MAX_MCP_REQUEST_BYTES + 1));
      const result = yield* readMcpRequest(request).pipe(Effect.result);

      expect(result).toMatchObject({
        _tag: "Failure",
        failure: { reason: "size" },
      });
      expect(pulls).toBe(0);
    })
  );

  it.live("stops an unbounded stream immediately after the ceiling", () =>
    Effect.gen(function* () {
      let cancelled = false;
      const request = streamRequest(
        new ReadableStream({
          /** Records cancellation after the byte ceiling is crossed. */
          cancel() {
            cancelled = true;
          },
          /** Enqueues one chunk just beyond the accepted ceiling. */
          start(controller) {
            controller.enqueue(new Uint8Array(MAX_MCP_REQUEST_BYTES + 1));
          },
        })
      );
      const result = yield* readMcpRequest(request).pipe(Effect.result);

      expect(result).toMatchObject({
        _tag: "Failure",
        failure: { reason: "size" },
      });
      expect(cancelled).toBe(true);
    })
  );

  it.live(
    "rejects malformed framing but preserves bounded JSON parse errors",
    () =>
      Effect.gen(function* () {
        const mismatch = yield* readMcpRequest(
          new Request("https://example.test/internal/mcp", {
            body: "{}",
            headers: {
              "content-length": "3",
              "content-type": "application/json",
            },
            method: "POST",
          })
        ).pipe(Effect.result);
        const malformed = yield* readMcpRequest(
          new Request("https://example.test/internal/mcp", {
            body: "{",
            headers: { "content-type": "application/json" },
            method: "POST",
          })
        );

        expect(mismatch).toMatchObject({
          _tag: "Failure",
          failure: { reason: "invalid" },
        });
        expect("parsedBody" in malformed).toBe(false);
        expect(yield* Effect.promise(() => malformed.request.text())).toBe("{");
      })
  );

  it.live("rejects invalid lengths, failed streams, and malformed UTF-8", () =>
    Effect.gen(function* () {
      const invalidLength = new Request("https://example.test/internal/mcp", {
        body: "{}",
        headers: {
          "content-length": "not-a-length",
          "content-type": "application/json",
        },
        method: "POST",
      });
      const failed = streamRequest(
        new ReadableStream({
          /** Fails the source on its first bounded read. */
          pull(controller) {
            controller.error(new Error("stream failed"));
          },
        })
      );
      const malformedUtf8 = streamRequest(
        new ReadableStream({
          /** Enqueues one invalid UTF-8 sequence. */
          start(controller) {
            controller.enqueue(new Uint8Array([0xc3, 0x28]));
            controller.close();
          },
        })
      );
      const absent = new Request("https://example.test/internal/mcp", {
        headers: {
          "content-length": "1",
          "content-type": "application/json",
        },
        method: "POST",
      });
      const results = yield* Effect.all(
        [invalidLength, failed, malformedUtf8, absent].map((request) =>
          readMcpRequest(request).pipe(Effect.result)
        )
      );

      for (const result of results) {
        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { reason: "invalid" },
        });
      }
    })
  );

  it.live("preserves one explicitly empty JSON request for SDK parsing", () =>
    Effect.gen(function* () {
      const [absent, empty] = yield* Effect.all([
        readMcpRequest(
          new Request("https://example.test/internal/mcp", {
            headers: {
              "content-length": "0",
              "content-type": "application/json",
            },
            method: "POST",
          })
        ),
        readMcpRequest(
          new Request("https://example.test/internal/mcp", {
            body: "",
            headers: {
              "content-length": "0",
              "content-type": "application/json",
            },
            method: "POST",
          })
        ),
      ]);

      expect("parsedBody" in absent).toBe(false);
      expect("parsedBody" in empty).toBe(false);
      expect(yield* Effect.promise(() => empty.request.text())).toBe("");
    })
  );

  it.live(
    "leaves bodyless methods and unsupported media types to the SDK",
    () =>
      Effect.gen(function* () {
        const get = new Request("https://example.test/internal/mcp");
        const unsupported = new Request("https://example.test/internal/mcp", {
          body: "plain text",
          headers: { "content-type": "text/plain" },
          method: "POST",
        });
        const [getResult, unsupportedResult] = yield* Effect.all([
          readMcpRequest(get),
          readMcpRequest(unsupported),
        ]);

        expect(getResult.request).toBe(get);
        expect(unsupportedResult.request).toBe(unsupported);
      })
  );
});
