import { Effect, Either, Schema } from "effect";

const DECIMAL_BYTES = /^\d+$/u;

/** A request or response omitted the readable body required by its contract. */
export class BodyMissingError extends Schema.TaggedError<BodyMissingError>()(
  "BodyMissingError",
  {}
) {}

/** A web body reader failed before the complete payload was available. */
export class BodyReadError extends Schema.TaggedError<BodyReadError>()(
  "BodyReadError",
  {}
) {}

/** A streamed web body crossed its caller-owned byte ceiling. */
export class BodyLimitError extends Schema.TaggedError<BodyLimitError>()(
  "BodyLimitError",
  {
    actualBytes: Schema.Number.pipe(Schema.int(), Schema.positive()),
    maxBytes: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }
) {}

/** A Content-Length value is malformed or exceeds its caller-owned ceiling. */
export class BodyLengthError extends Schema.TaggedError<BodyLengthError>()(
  "BodyLengthError",
  {
    reason: Schema.Literal("invalid", "limit"),
  }
) {}

/** Copies ordered chunks into one exactly sized byte array. */
function concatenateChunks(chunks: readonly Uint8Array[], totalBytes: number) {
  const result = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

type BoundedBodyError = BodyLimitError | BodyMissingError | BodyReadError;

interface BoundedBodyRead {
  readonly cancel?: () => void;
  readonly result: Promise<Either.Either<Uint8Array, BoundedBodyError>>;
}

/** Settles reader cancellation without hiding the primary body result. */
function settleReaderCancellation(
  reader: ReadableStreamDefaultReader<Uint8Array>
) {
  Promise.resolve()
    .then(() => reader.cancel())
    .then(
      () => undefined,
      () => undefined
    );
}

/** Starts one bounded body read with an interruptible cancellation handle. */
function startBoundedBodyRead(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number
): BoundedBodyRead {
  if (!body) {
    return {
      result: Promise.resolve(Either.left(new BodyMissingError())),
    };
  }

  const readerResult = Either.try({
    catch: () => new BodyReadError(),
    try: () => body.getReader(),
  });
  if (Either.isLeft(readerResult)) {
    return {
      result: Promise.resolve(Either.left(readerResult.left)),
    };
  }

  const reader = readerResult.right;
  let cancelled = false;

  function cancel() {
    cancelled = true;
    settleReaderCancellation(reader);
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  /** Pulls one provider chunk and preserves its typed result. */
  function pull(): Promise<Either.Either<Uint8Array, BoundedBodyError>> {
    return Promise.resolve()
      .then(() => reader.read())
      .then(
        ({ done, value }) => {
          if (cancelled) {
            return Either.left(new BodyReadError());
          }
          if (done) {
            return Either.right(concatenateChunks(chunks, totalBytes));
          }

          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            cancel();
            return Either.left(
              new BodyLimitError({ actualBytes: totalBytes, maxBytes })
            );
          }

          chunks.push(value);
          return pull();
        },
        () => Either.left(new BodyReadError())
      );
  }

  return { cancel, result: pull() };
}

/** Parses an optional decimal Content-Length without unsafe number coercion. */
export const parseContentLength = Effect.fn("Utilities.parseContentLength")(
  function* (value: string | null, maxBytes: number) {
    if (value === null) {
      return null;
    }
    if (!DECIMAL_BYTES.test(value)) {
      return yield* new BodyLengthError({ reason: "invalid" });
    }

    const byteLength = Number(value);
    if (!Number.isSafeInteger(byteLength)) {
      return yield* new BodyLengthError({ reason: "invalid" });
    }
    if (byteLength > maxBytes) {
      return yield* new BodyLengthError({ reason: "limit" });
    }

    return byteLength;
  }
);

/** Reads a web body without a runtime or buffering beyond the declared limit. */
export function readBoundedBodyResult(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number
) {
  return startBoundedBodyRead(body, maxBytes).result;
}

/** Reads a web body stream with typed failure and interruption cancellation. */
export const readBoundedBody = Effect.fn("Utilities.readBoundedBody")(
  (body: ReadableStream<Uint8Array> | null, maxBytes: number) =>
    Effect.async<Uint8Array, BoundedBodyError>((resume) => {
      const read = startBoundedBodyRead(body, maxBytes);
      read.result.then((result) => {
        if (Either.isLeft(result)) {
          resume(Effect.fail(result.left));
          return;
        }
        resume(Effect.succeed(result.right));
      });

      if (read.cancel === undefined) {
        return;
      }
      return Effect.sync(read.cancel);
    })
);
