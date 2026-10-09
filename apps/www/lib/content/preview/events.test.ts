// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { PreviewEventSchema } from "@nakafa/aksara-contracts/preview/spec";
import { Data, Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
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

const target = "http://127.0.0.1:4000/events";
const configMock = vi.mocked(readPreviewConfig);
/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();
const route = {
  appLocale: previewRoute.appLocale,
  publicPath: previewRoute.publicPath,
};
const encodePreviewEvent = Schema.encodeSync(
  Schema.fromJsonString(PreviewEventSchema)
);

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

/** Opens the provider stream through the controlled fetch. */
function openEvents(signal = new AbortController().signal) {
  return openPreviewEvents(signal).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/** Builds one valid event-stream response around a provider body. */
function eventResponse(body: BodyInit | null) {
  return response(body, {
    headers: { "content-type": "text/event-stream" },
    status: 200,
  });
}

/** Opens and consumes one finite test event stream. */
function readEvents() {
  return openEvents().pipe(
    Effect.flatMap((stream) =>
      Effect.promise(() => new Response(stream).text())
    )
  );
}

/** Returns the typed failure produced before a stream is established. */
function openFailure(signal?: AbortSignal) {
  return openEvents(signal).pipe(Effect.flip);
}

/** Consumes one stream that is expected to fail after response validation. */
function streamFailure(source: BodyInit | null) {
  fetcher.mockResolvedValue(eventResponse(source));
  return openEvents().pipe(
    Effect.flatMap((stream) =>
      Effect.tryPromise({
        catch: (cause) =>
          Schema.is(PreviewEventError)(cause)
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
  fetcher.mockReset();
  configMock.mockReset();
  configMock.mockReturnValue(Effect.succeedSome(previewConfig));
});

describe("local preview events", () => {
  it.effect("fails explicitly when no local provider is configured", () =>
    Effect.gen(function* () {
      configMock.mockReturnValueOnce(Effect.succeedNone);

      expect(yield* openFailure()).toMatchObject({
        _tag: "PreviewUnavailableError",
      });
    })
  );

  it.effect(
    "maps provider connection failures without exposing their cause",
    () =>
      Effect.gen(function* () {
        fetcher.mockRejectedValue(new TypeError("private failure"));

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
        configMock.mockReturnValueOnce(
          Effect.fail(PreviewConfigError.make({ name: "AKSARA_PREVIEW" }))
        );

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
  ] as const)("rejects an invalid %s response", ([_label, value]) =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(value);

      expect(yield* openFailure()).toMatchObject({
        _tag: "PreviewEventError",
        stage: "response",
      });
    })
  );

  it.effect("fails the stream of a response that has no body", () =>
    Effect.gen(function* () {
      expect(yield* streamFailure(null)).toMatchObject({
        _tag: "PreviewEventError",
        stage: "response",
      });
    })
  );

  it.effect.each([
    ["before", true],
    ["while", false],
  ] as const)(
    "stops connecting when the browser left %s the request",
    ([_label, isAborted]) => {
      const browser = new AbortController();
      return Effect.gen(function* () {
        fetcher.mockImplementation(() => {
          browser.abort();
          return new Promise<Response>(() => undefined);
        });
        if (isAborted) {
          browser.abort();
        }

        expect(yield* openFailure(browser.signal)).toMatchObject({
          _tag: "PreviewRequestError",
          stage: "connect",
        });
        expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      });
    }
  );

  it.effect("ends the provider stream when the browser leaves it", () => {
    const browser = new AbortController();
    return Effect.gen(function* () {
      const cancel = vi.fn();
      fetcher.mockResolvedValue(
        eventResponse(
          new ReadableStream<Uint8Array>({
            cancel,
            /** Sends one heartbeat and then stays open like a live provider. */
            start(controller) {
              controller.enqueue(new TextEncoder().encode(": ping\n\n"));
            },
          })
        )
      );
      const reader = (yield* openEvents(browser.signal)).getReader();

      expect(
        new TextDecoder().decode(
          (yield* Effect.promise(() => reader.read())).value
        )
      ).toBe(": keep-alive\n\n");
      browser.abort();

      expect((yield* Effect.promise(() => reader.read())).done).toBe(true);
      expect(cancel).toHaveBeenCalledOnce();
    });
  });

  it.effect(
    "forwards only complete schema-validated updates and heartbeats",
    () =>
      Effect.gen(function* () {
        const pending = encodePreviewEvent({
          format: "aksara-local-preview",
          revision: 1,
          route,
          status: "pending",
        });
        const ready = encodePreviewEvent({
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
        fetcher.mockResolvedValue(
          response(source, {
            headers: {
              "content-type": "text/event-stream; charset=utf-8",
            },
            status: 200,
          })
        );

        expect(yield* readEvents()).toBe(
          `event: update\ndata: ${pending}\n\n: keep-alive\n\nevent: update\ndata: ${ready}\n\n`
        );
        expect(fetcher).toHaveBeenCalledWith(
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
