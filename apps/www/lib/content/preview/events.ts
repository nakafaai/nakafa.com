import "server-only";

import { PreviewEventSchema } from "@nakafa/aksara-contracts/preview/spec";
import { Effect, Either, Option, Redacted, Schema } from "effect";
import { previewUrl, readPreviewConfig } from "@/lib/content/preview/config";
import {
  PreviewEventError,
  PreviewRequestError,
  PreviewUnavailableError,
} from "@/lib/content/preview/errors";

const MAX_EVENT_BYTES = 4096;
const EVENT_BOUNDARY = "\n\n";
const EVENT_PREFIX = "event: update\ndata: ";
const EVENT_CONTENT_TYPE = /^text\/event-stream(?:\s*;\s*charset=utf-8)?$/i;
const encoder = new TextEncoder();

/** Strictly validates and re-encodes one provider event for the browser. */
function sanitizeEvent(block: string) {
  if (!block.startsWith(EVENT_PREFIX)) {
    return Either.left(new PreviewEventError({ stage: "event" }));
  }

  const source = block.slice(EVENT_PREFIX.length);
  if (source.includes("\n")) {
    return Either.left(new PreviewEventError({ stage: "event" }));
  }

  const decoded = Schema.decodeUnknownEither(
    Schema.parseJson(PreviewEventSchema)
  )(source, { onExcessProperty: "error" });
  if (Either.isLeft(decoded)) {
    return Either.left(new PreviewEventError({ stage: "event" }));
  }

  return Either.right(
    encoder.encode(`${EVENT_PREFIX}${JSON.stringify(decoded.right)}\n\n`)
  );
}

/** Sanitizes provider chunks and prevents unbounded partial-event buffering. */
function sanitizeStream(source: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffered = "";

  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      /** Emits only complete schema-validated events. */
      transform(chunk, controller) {
        buffered += decoder.decode(chunk, { stream: true });
        let boundary = buffered.indexOf(EVENT_BOUNDARY);

        while (boundary >= 0) {
          const block = buffered.slice(0, boundary);
          if (encoder.encode(block).byteLength > MAX_EVENT_BYTES) {
            controller.error(new PreviewEventError({ stage: "event" }));
            return;
          }
          const event = sanitizeEvent(block);
          buffered = buffered.slice(boundary + EVENT_BOUNDARY.length);
          if (Either.isLeft(event)) {
            controller.error(event.left);
            return;
          }
          controller.enqueue(event.right);
          boundary = buffered.indexOf(EVENT_BOUNDARY);
        }

        if (encoder.encode(buffered).byteLength > MAX_EVENT_BYTES) {
          controller.error(new PreviewEventError({ stage: "event" }));
        }
      },
      /** Rejects a provider that closes in the middle of an event. */
      flush(controller) {
        buffered += decoder.decode();
        if (buffered.length > 0) {
          controller.error(new PreviewEventError({ stage: "event" }));
        }
      },
    })
  );
}

/** Validates the authenticated provider response before exposing its stream. */
function validateResponse(response: Response, target: URL) {
  const contentType = response.headers.get("content-type") ?? "";
  if (
    response.status !== 200 ||
    response.url !== target.toString() ||
    !EVENT_CONTENT_TYPE.test(contentType) ||
    !response.body
  ) {
    return Effect.fail(new PreviewEventError({ stage: "response" }));
  }

  return Effect.succeed(sanitizeStream(response.body));
}

/** Opens the private provider stream and returns only sanitized update events. */
export const openPreviewEvents = Effect.fn("NakafaContent.openPreviewEvents")(
  function* (signal: AbortSignal) {
    const configOption = yield* readPreviewConfig();
    if (Option.isNone(configOption)) {
      return yield* new PreviewUnavailableError({});
    }

    const config = configOption.value;
    const target = yield* previewUrl(config, config.eventsPath);
    const response = yield* Effect.tryPromise({
      catch: () => new PreviewRequestError({ stage: "connect" }),
      try: () =>
        fetch(target, {
          cache: "no-store",
          credentials: "omit",
          headers: {
            accept: "text/event-stream",
            authorization: `Bearer ${Redacted.value(config.token)}`,
          },
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal,
        }),
    });

    return yield* validateResponse(response, target);
  }
);
