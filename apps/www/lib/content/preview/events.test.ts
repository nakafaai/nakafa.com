// @vitest-environment node

import { Effect, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PreviewConfigError,
  readPreviewConfig,
} from "@/lib/content/preview/config";
import { openPreviewEvents } from "@/lib/content/preview/events";
import { previewConfig } from "@/test/content-preview";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/preview/config", async (importOriginal) => ({
  ...(await importOriginal()),
  readPreviewConfig: vi.fn(),
}));

const target = "http://127.0.0.1:4000/v1/events";
const configMock = vi.mocked(readPreviewConfig);

/** Builds one response whose final URL matches the Fetch contract. */
function response(
  body: BodyInit | null,
  options?: ResponseInit & { readonly url?: string }
) {
  const value = new Response(body, options);
  Object.defineProperty(value, "url", { value: options?.url ?? target });
  return value;
}

/** Opens and consumes one finite test event stream. */
async function readEvents() {
  const stream = await Effect.runPromise(
    openPreviewEvents(new AbortController().signal)
  );
  return await new Response(stream).text();
}

/** Returns the typed failure produced before a stream is established. */
function openFailure() {
  return Effect.runPromise(
    openPreviewEvents(new AbortController().signal).pipe(Effect.flip)
  );
}

/** Consumes one stream that is expected to fail after response validation. */
async function streamFailure(source: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        response(source, {
          headers: { "content-type": "text/event-stream" },
          status: 200,
        })
      )
    )
  );
  const stream = await Effect.runPromise(
    openPreviewEvents(new AbortController().signal)
  );
  return new Response(stream).text();
}

beforeEach(() => {
  configMock.mockReset();
  configMock.mockReturnValue(Effect.succeed(Option.some(previewConfig)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local preview events", () => {
  it("fails explicitly when no local provider is configured", async () => {
    configMock.mockReturnValueOnce(Effect.succeed(Option.none()));

    await expect(openFailure()).resolves.toMatchObject({
      _tag: "PreviewUnavailableError",
    });
  });

  it("maps provider connection failures without exposing their cause", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("private failure")))
    );

    await expect(openFailure()).resolves.toMatchObject({
      _tag: "PreviewRequestError",
      stage: "connect",
    });
  });

  it("does not send its bearer token after configuration validation fails", async () => {
    const fetcher = vi.fn();
    configMock.mockReturnValueOnce(
      Effect.fail(new PreviewConfigError({ name: "AKSARA_PREVIEW" }))
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(openFailure()).resolves.toMatchObject({
      _tag: "PreviewConfigError",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ["status", response(null, { status: 401 })],
    [
      "url",
      response(null, {
        headers: { "content-type": "text/event-stream" },
        status: 200,
        url: "http://127.0.0.1:4000/elsewhere",
      }),
    ],
    ["missing content type", response(null, { status: 200 })],
    [
      "non-event content type",
      response("event: update\ndata: {}\n\n", {
        headers: { "content-type": "text/event-stream-data" },
        status: 200,
      }),
    ],
    [
      "body",
      response(null, {
        headers: { "content-type": "text/event-stream" },
        status: 200,
      }),
    ],
  ])("rejects an invalid %s response", async (_label, value) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(value))
    );

    await expect(openFailure()).resolves.toMatchObject({
      _tag: "PreviewEventError",
      stage: "response",
    });
  });

  it("forwards only complete schema-validated updates", async () => {
    const source = new ReadableStream<Uint8Array>({
      /** Splits two valid events across provider chunks. */
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'event: update\ndata: {"format":"aksara-local-preview-v1",'
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            '"revision":1,"status":"pending"}\n\nevent: update\ndata: {"format":"aksara-local-preview-v1","revision":2,"status":"ready"}\n\n'
          )
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response(source, {
            headers: { "content-type": "text/event-stream; charset=utf-8" },
            status: 200,
          })
        )
      )
    );

    await expect(readEvents()).resolves.toBe(
      'event: update\ndata: {"format":"aksara-local-preview-v1","revision":1,"status":"pending"}\n\nevent: update\ndata: {"format":"aksara-local-preview-v1","revision":2,"status":"ready"}\n\n'
    );
    expect(fetch).toHaveBeenCalledWith(
      new URL(target),
      expect.objectContaining({
        cache: "no-store",
        credentials: "omit",
        headers: {
          accept: "text/event-stream",
          authorization: "Bearer test-token",
        },
        redirect: "error",
        referrerPolicy: "no-referrer",
      })
    );
  });

  it.each([
    ["event name", 'event: other\ndata: {"revision":1}\n\n'],
    ["extra line", "event: update\ndata: {}\nextra: value\n\n"],
    ["invalid data", "event: update\ndata: not-json\n\n"],
    [
      "oversized complete event",
      `event: update\ndata: ${"x".repeat(4097)}\n\n`,
    ],
    ["oversized partial event", "x".repeat(4097)],
    ["unfinished event", "event: update\ndata: {}"],
  ])("rejects a malformed %s", async (_label, source) => {
    await expect(streamFailure(source)).rejects.toMatchObject({
      _tag: "PreviewEventError",
      stage: "event",
    });
  });
});
