// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Data, Effect, Option } from "effect";
import {
  PreviewConfigError,
  readPreviewConfig,
} from "@/lib/content/preview/config";
import { PreviewEventError } from "@/lib/content/preview/errors";
import { openPreviewEvents } from "@/lib/content/preview/events";
import { previewConfig, previewRoute } from "@/test/content-preview";

vi.mock("@/lib/content/preview/config", async (importOriginal) => ({
  ...(await importOriginal()),
  readPreviewConfig: vi.fn(),
}));

const target = "http://127.0.0.1:4000/v1/events";
const configMock = vi.mocked(readPreviewConfig);
const route = {
  appLocale: previewRoute.appLocale,
  publicPath: previewRoute.publicPath,
};

class UnexpectedPreviewStreamError extends Data.TaggedError(
  "UnexpectedPreviewStreamError"
)<{ readonly cause: unknown }> {}

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
function readEvents() {
  return openPreviewEvents(new AbortController().signal).pipe(
    Effect.flatMap((stream) =>
      Effect.promise(() => new Response(stream).text())
    )
  );
}

/** Returns the typed failure produced before a stream is established. */
function openFailure() {
  return openPreviewEvents(new AbortController().signal).pipe(Effect.flip);
}

/** Consumes one stream that is expected to fail after response validation. */
function streamFailure(source: string) {
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
  return openPreviewEvents(new AbortController().signal).pipe(
    Effect.flatMap((stream) =>
      Effect.tryPromise({
        catch: (cause) =>
          cause instanceof PreviewEventError
            ? cause
            : new UnexpectedPreviewStreamError({ cause }),
        try: () => new Response(stream).text(),
      })
    ),
    Effect.catchTag("UnexpectedPreviewStreamError", ({ cause }) =>
      Effect.die(cause)
    ),
    Effect.flip
  );
}

beforeEach(() => {
  configMock.mockReset();
  configMock.mockReturnValue(Effect.succeed(Option.some(previewConfig)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local preview events", () => {
  it.effect("fails explicitly when no local provider is configured", () =>
    Effect.gen(function* () {
      configMock.mockReturnValueOnce(Effect.succeed(Option.none()));

      expect(yield* openFailure()).toMatchObject({
        _tag: "PreviewUnavailableError",
      });
    })
  );

  it.effect(
    "maps provider connection failures without exposing their cause",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "fetch",
          vi.fn(() => Promise.reject(new TypeError("private failure")))
        );

        expect(yield* openFailure()).toMatchObject({
          _tag: "PreviewRequestError",
          stage: "connect",
        });
      })
  );

  it.effect(
    "does not send its bearer token after configuration validation fails",
    () =>
      Effect.gen(function* () {
        const fetcher = vi.fn();
        configMock.mockReturnValueOnce(
          Effect.fail(new PreviewConfigError({ name: "AKSARA_PREVIEW" }))
        );
        vi.stubGlobal("fetch", fetcher);

        expect(yield* openFailure()).toMatchObject({
          _tag: "PreviewConfigError",
        });
        expect(fetcher).not.toHaveBeenCalled();
      })
  );

  it.effect.each([
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
  ])("rejects an invalid %s response", ([_label, value]) =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(value))
      );

      expect(yield* openFailure()).toMatchObject({
        _tag: "PreviewEventError",
        stage: "response",
      });
    })
  );

  it.effect(
    "forwards only complete schema-validated updates and heartbeats",
    () =>
      Effect.gen(function* () {
        const pending = JSON.stringify({
          format: "aksara-local-preview",
          revision: 1,
          route,
          status: "pending",
        });
        const ready = JSON.stringify({
          format: "aksara-local-preview",
          revision: 2,
          route,
          status: "ready",
        });
        const source = new ReadableStream<Uint8Array>({
          /** Splits two valid events across provider chunks. */
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                `event: update\ndata: ${pending.slice(0, 48)}`
              )
            );
            controller.enqueue(
              new TextEncoder().encode(
                `${pending.slice(48)}\n\n: provider-owned-heartbeat\n\nevent: update\ndata: ${ready}\n\n`
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
                headers: {
                  "content-type": "text/event-stream; charset=utf-8",
                },
                status: 200,
              })
            )
          )
        );

        expect(yield* readEvents()).toBe(
          `event: update\ndata: ${pending}\n\n: keep-alive\n\nevent: update\ndata: ${ready}\n\n`
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
      })
  );

  it.effect.each([
    ["event name", 'event: other\ndata: {"revision":1}\n\n'],
    ["multiline comment", ": first\n: second\n\n"],
    ["extra line", "event: update\ndata: {}\nextra: value\n\n"],
    ["invalid data", "event: update\ndata: not-json\n\n"],
    [
      "oversized complete event",
      `event: update\ndata: ${"x".repeat(4097)}\n\n`,
    ],
    ["oversized partial event", "x".repeat(4097)],
    ["unfinished event", "event: update\ndata: {}"],
  ])("rejects a malformed %s", ([_label, source]) =>
    Effect.gen(function* () {
      expect(yield* streamFailure(source)).toMatchObject({
        _tag: "PreviewEventError",
        stage: "event",
      });
    })
  );
});
