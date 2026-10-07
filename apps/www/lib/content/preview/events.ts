import "server-only";
import { PreviewEventSchema } from "@nakafa/aksara-contracts/preview/spec";
import {
  Array as Arr,
  Effect,
  Option,
  Result,
  Schema,
  String as Str,
  Stream,
} from "effect";
import {
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";
import { previewUrl, readPreviewConfig } from "@/lib/content/preview/config";
import {
  PreviewEventError,
  PreviewRequestError,
  PreviewUnavailableError,
} from "@/lib/content/preview/errors";
import { PreviewHttpClient } from "@/lib/content/preview/request";

const MAX_EVENT_BYTES = 4096;
const EVENT_BOUNDARY = "\n\n";
const EVENT_HEARTBEAT = ": keep-alive";
const EVENT_PREFIX = "event: update\ndata: ";
const EVENT_CONTENT_TYPE = /^text\/event-stream(?:\s*;\s*charset=utf-8)?$/i;
const encoder = new TextEncoder();
/** Strictly validates and re-encodes one provider event for the browser. */
function sanitizeEvent(block: string) {
  if (block.startsWith(":") && !block.includes("\n")) {
    return Result.succeed(encoder.encode(`${EVENT_HEARTBEAT}\n\n`));
  }
  if (!block.startsWith(EVENT_PREFIX)) {
    return Result.fail(new PreviewEventError({ stage: "event" }));
  }
  const source = block.slice(EVENT_PREFIX.length);
  if (source.includes("\n")) {
    return Result.fail(new PreviewEventError({ stage: "event" }));
  }
  const decoded = Schema.decodeResult(
    Schema.fromJsonString(PreviewEventSchema)
  )(source, { onExcessProperty: "error" });
  if (Result.isFailure(decoded)) {
    return Result.fail(new PreviewEventError({ stage: "event" }));
  }
  return Result.succeed(
    encoder.encode(`${EVENT_PREFIX}${JSON.stringify(decoded.success)}\n\n`)
  );
}
type SanitizedEvent = Result.Result<Uint8Array, PreviewEventError>;

/** Checks one block or unfinished tail against the per-event byte ceiling. */
function isOversized(text: string) {
  return encoder.encode(text).byteLength > MAX_EVENT_BYTES;
}
/** Validates every complete event in the provider text and keeps the unfinished tail. */
function sanitizeText(
  text: string
): readonly [pending: string, events: readonly SanitizedEvent[]] {
  const blocks = Str.split(text, EVENT_BOUNDARY);
  const pending = Arr.lastNonEmpty(blocks);
  const events = Arr.map(Arr.initNonEmpty(blocks), (block) =>
    isOversized(block)
      ? Result.fail(new PreviewEventError({ stage: "event" }))
      : sanitizeEvent(block)
  );
  return [
    pending,
    isOversized(pending)
      ? Arr.append(
          events,
          Result.fail(new PreviewEventError({ stage: "event" }))
        )
      : events,
  ];
}
/** Sanitizes provider chunks and prevents unbounded partial-event buffering. */
function sanitizeStream<Failure, Requirements>(
  source: Stream.Stream<Uint8Array, Failure, Requirements>
) {
  return Stream.suspend(() => {
    const decoder = new TextDecoder();
    return source.pipe(
      Stream.mapAccum(
        () => "",
        (pending: string, chunk: Uint8Array) =>
          sanitizeText(`${pending}${decoder.decode(chunk, { stream: true })}`),
        {
          /** Rejects a provider that closes in the middle of an event. */
          onHalt: (pending): readonly SanitizedEvent[] =>
            `${pending}${decoder.decode()}`.length > 0
              ? [Result.fail(new PreviewEventError({ stage: "event" }))]
              : [],
        }
      ),
      // The first rejected event ends the stream, so nothing after it is sent.
      Stream.mapEffect((event) => Effect.fromResult(event))
    );
  });
}
/** Completes once the browser gives up on its event request. */
function waitForAbort(signal: AbortSignal) {
  return Effect.callback<void>((resume) => {
    const abort = () => resume(Effect.void);
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    return Effect.sync(() => signal.removeEventListener("abort", abort));
  });
}
/** Validates the authenticated provider response before exposing its stream. */
function validateResponse(
  response: HttpClientResponse.HttpClientResponse,
  target: URL
) {
  if (
    response.status !== 200 ||
    response.url !== target.toString() ||
    !EVENT_CONTENT_TYPE.test(response.headers["content-type"] ?? "")
  ) {
    return Effect.fail(new PreviewEventError({ stage: "response" }));
  }
  return Effect.succeed(
    sanitizeStream(
      response.stream.pipe(
        Stream.mapError(() => new PreviewEventError({ stage: "response" }))
      )
    )
  );
}
/** Opens the private provider stream and returns sanitized updates and heartbeats. */
export const openPreviewEvents = Effect.fn("NakafaContent.openPreviewEvents")(
  function* (signal: AbortSignal) {
    const configOption = yield* readPreviewConfig();
    if (Option.isNone(configOption)) {
      return yield* new PreviewUnavailableError({});
    }
    const config = configOption.value;
    const target = yield* previewUrl(config, config.eventsPath);
    const client = yield* HttpClient.HttpClient;
    const response = yield* HttpClientRequest.get(target).pipe(
      HttpClientRequest.accept("text/event-stream"),
      HttpClientRequest.bearerToken(config.token),
      client.execute,
      Effect.raceFirst(Effect.flip(waitForAbort(signal))),
      Effect.mapError(() => new PreviewRequestError({ stage: "connect" }))
    );
    const events = yield* validateResponse(response, target);
    return yield* events.pipe(
      Stream.interruptWhen(waitForAbort(signal)),
      Stream.toReadableStreamEffect()
    );
  },
  Effect.provide(PreviewHttpClient)
);
