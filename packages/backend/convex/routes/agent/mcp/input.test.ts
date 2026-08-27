// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  MAX_MCP_REQUEST_BYTES,
  readMcpRequest,
} from "@repo/backend/convex/routes/agent/mcp/input";
import { Effect } from "effect";

/** Creates one Node request whose stream has no declared byte length. */
function streamRequest(
  body: ReadableStream<Uint8Array>,
  contentType: string | undefined = "application/json"
) {
  const init = {
    body,
    duplex: "half",
    headers:
      contentType === undefined ? undefined : { "content-type": contentType },
    method: "POST",
  } satisfies RequestInit & { readonly duplex: "half" };
  return new Request("https://example.test/internal/mcp", init);
}

describe("MCP request input", () => {
  it.effect("accepts the exact policy ceiling and parses the body once", () =>
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

  it.effect("rejects an oversized declaration without consuming the body", () =>
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

  it.effect("stops every unbounded POST stream after the ceiling", () =>
    Effect.gen(function* () {
      const cancelled = [false, false, false];
      const requests = ["application/json", "text/plain", undefined].map(
        (contentType, index) =>
          streamRequest(
            new ReadableStream({
              /** Records cancellation after the byte ceiling is crossed. */
              cancel() {
                cancelled[index] = true;
              },
              /** Enqueues one chunk just beyond the accepted ceiling. */
              start(controller) {
                controller.enqueue(new Uint8Array(MAX_MCP_REQUEST_BYTES + 1));
              },
            }),
            contentType
          )
      );
      const results = yield* Effect.all(
        requests.map((request) => readMcpRequest(request).pipe(Effect.result))
      );

      for (const result of results) {
        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { reason: "size" },
        });
      }
      expect(cancelled).toEqual([true, true, true]);
    })
  );

  it.effect(
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

  it.effect(
    "rejects invalid lengths, failed streams, and malformed UTF-8",
    () =>
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

  it.effect("preserves one explicitly empty JSON request for SDK parsing", () =>
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

  it.effect("bounds unsupported media types before SDK rejection", () =>
    Effect.gen(function* () {
      const unsupported = new Request("https://example.test/internal/mcp", {
        body: "plain text",
        headers: { "content-type": "text/plain" },
        method: "POST",
      });
      const missing = streamRequest(
        new ReadableStream({
          /** Enqueues one body without a media type. */
          start(controller) {
            controller.enqueue(new TextEncoder().encode("missing type"));
            controller.close();
          },
        }),
        undefined
      );
      const [unsupportedResult, missingResult] = yield* Effect.all([
        readMcpRequest(unsupported),
        readMcpRequest(missing),
      ]);

      expect("parsedBody" in unsupportedResult).toBe(false);
      expect("parsedBody" in missingResult).toBe(false);
      expect(
        yield* Effect.promise(() => unsupportedResult.request.text())
      ).toBe("plain text");
      expect(yield* Effect.promise(() => missingResult.request.text())).toBe(
        "missing type"
      );
    })
  );

  it.effect("leaves bodyless methods unchanged", () =>
    Effect.gen(function* () {
      const get = new Request("https://example.test/internal/mcp");
      const getResult = yield* readMcpRequest(get);

      expect(getResult.request).toBe(get);
    })
  );
});
